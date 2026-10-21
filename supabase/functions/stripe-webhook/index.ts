import type { Json, PlanCodeEnum, SubscriptionStatus } from "@shared/db/types.ts";
import { startBackgroundCheck } from "../_shared/background-check.ts";
import { internalUpdate } from "../_shared/db.ts";
import { env, requireEnv } from "../_shared/env.ts";
import { badRequest } from "../_shared/errors.ts";
import { json, serve } from "../_shared/http.ts";
import { notifyCompany, notifyUser } from "../_shared/notify.ts";
import { recordPaymentIntentResult } from "../_shared/payments.ts";
import { Stripe, idOf, stripeClient, unixToIso } from "../_shared/stripe.ts";
import { type Db, serviceClient } from "../_shared/supabase.ts";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Stripe webhook. Signature-verified, idempotent via stripe_events (insert first; duplicates are
 * acknowledged and skipped). A handler failure removes the event row and returns 500 so Stripe retries.
 */
serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) throw badRequest("missing_signature", "Missing Stripe-Signature header.");
  const rawBody = await req.text();
  const stripe = stripeClient();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      requireEnv("STRIPE_WEBHOOK_SECRET"),
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.warn("stripe-webhook: signature verification failed", err instanceof Error ? err.message : err);
    throw badRequest("invalid_signature", "Webhook signature verification failed.");
  }

  const db = serviceClient();
  const { data: inserted, error: insErr } = await db
    .from("stripe_events")
    .upsert({ id: event.id, type: event.type, payload: event as unknown as Json }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (insErr) throw insErr;
  if (!inserted || inserted.length === 0) {
    return json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(db, stripe, event);
  } catch (err) {
    console.error(`stripe-webhook: handler failed for ${event.type} ${event.id}`, err);
    const { error: delErr } = await db.from("stripe_events").delete().eq("id", event.id);
    if (delErr) console.error("stripe-webhook: could not release event for retry", delErr.message);
    throw err;
  }
  return json({ received: true });
});

function handleEvent(db: Db, stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return onCheckoutCompleted(db, stripe, event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return applySubscription(db, event.data.object, false);
    case "customer.subscription.deleted":
      return applySubscription(db, event.data.object, true);
    case "invoice.payment_failed":
      return onInvoicePaymentFailed(db, event.data.object);
    case "customer.updated":
      return onCustomerUpdated(event.data.object);
    case "payment_method.attached":
      return onPaymentMethodAttached(db, stripe, event.data.object);
    case "account.updated":
      return onAccountUpdated(db, event.data.object);
    case "payment_intent.succeeded":
      return onPaymentIntent(db, event.data.object, "succeeded");
    case "payment_intent.payment_failed":
      return onPaymentIntent(db, event.data.object, "failed");
    case "charge.refunded":
      return onChargeRefunded(db, event.data.object);
    default:
      return Promise.resolve();
  }
}

// ---------- Checkout ----------

async function onCheckoutCompleted(db: Db, stripe: Stripe, session: Stripe.Checkout.Session): Promise<void> {
  const meta = session.metadata ?? {};

  if (meta["kind"] === "signup_fee" && meta["user_id"]) {
    if (session.payment_status !== "paid") return; // async payment still pending
    const userId = meta["user_id"];
    const { data: op, error } = await db
      .from("officer_profiles")
      .select("signup_fee_paid_at, background_status")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!op) {
      console.warn("stripe-webhook: signup fee paid for unknown officer", userId);
      return;
    }
    if (!op.signup_fee_paid_at) {
      await internalUpdate("officer_profiles", { column: "user_id", value: userId }, {
        signup_fee_paid_at: new Date().toISOString(),
        signup_fee_checkout_session_id: session.id,
      });
    }
    if (op.background_status === "not_started") {
      await startBackgroundCheck(db, userId);
    }
    await notifyUser(db, userId, {
      kind: "signup.fee_paid",
      title: "Signup fee received",
      body: "Thanks! Your background check has started. We'll let you know when it clears.",
      channels: ["push", "email"],
    });
    return;
  }

  if (session.mode === "subscription" && meta["company_id"]) {
    const companyId = meta["company_id"];
    const subscriptionId = idOf(session.subscription);
    const customerId = idOf(session.customer);
    await internalUpdate("companies", { column: "id", value: companyId }, {
      ...(customerId ? { stripe_customer_id: customerId } : {}),
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    });
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await applySubscription(db, subscription, false);
    }
  }
}

// ---------- Subscriptions / billing ----------

const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "none", "trialing", "active", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused",
];

function toSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(status) ? (status as SubscriptionStatus) : "none";
}

async function findCompanyByCustomer(db: Db, customerId: string | null): Promise<{ id: string; subscription_status: SubscriptionStatus } | null> {
  if (!customerId) return null;
  const { data, error } = await db
    .from("companies")
    .select("id, subscription_status")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const PLAN_CODES: readonly PlanCodeEnum[] = ["essential", "pro", "enterprise"];

function asPlanCode(value: string | undefined): PlanCodeEnum | null {
  return value && (PLAN_CODES as readonly string[]).includes(value) ? (value as PlanCodeEnum) : null;
}

async function resolvePlanId(db: Db, planCodeRaw: string | undefined, priceId: string | null): Promise<string | null> {
  const planCode = asPlanCode(planCodeRaw);
  if (planCode) {
    const { data, error } = await db.from("plans").select("id").eq("code", planCode).maybeSingle();
    if (error) throw error;
    if (data) return data.id;
  }
  if (priceId) {
    const { data, error } = await db.from("plans").select("id").eq("stripe_price_id", priceId).maybeSingle();
    if (error) throw error;
    if (data) return data.id;
    for (const code of PLAN_CODES) {
      if (env(`STRIPE_PRICE_${code.toUpperCase()}`) === priceId) {
        const { data: byCode, error: cErr } = await db.from("plans").select("id").eq("code", code).maybeSingle();
        if (cErr) throw cErr;
        if (byCode) return byCode.id;
      }
    }
  }
  return null;
}

async function applySubscription(db: Db, sub: Stripe.Subscription, deleted: boolean): Promise<void> {
  const customerId = idOf(sub.customer);
  let companyId: string | null = sub.metadata?.["company_id"] ?? null;
  let previousStatus: SubscriptionStatus | null = null;
  if (companyId) {
    const { data, error } = await db.from("companies").select("id, subscription_status").eq("id", companyId).maybeSingle();
    if (error) throw error;
    previousStatus = data?.subscription_status ?? null;
    if (!data) companyId = null;
  }
  if (!companyId) {
    const company = await findCompanyByCustomer(db, customerId);
    if (!company) {
      console.warn("stripe-webhook: subscription for unknown company", sub.id);
      return;
    }
    companyId = company.id;
    previousStatus = company.subscription_status;
  }

  const status: SubscriptionStatus = deleted ? "canceled" : toSubscriptionStatus(sub.status);
  const item = sub.items.data[0];
  const planId = await resolvePlanId(db, sub.metadata?.["plan_code"], item ? item.price.id : null);
  const defaultPaymentMethod = idOf(sub.default_payment_method);

  await internalUpdate("companies", { column: "id", value: companyId }, {
    stripe_subscription_id: sub.id,
    ...(customerId ? { stripe_customer_id: customerId } : {}),
    subscription_status: status,
    current_period_start: item ? unixToIso(item.current_period_start) : null,
    current_period_end: item ? unixToIso(item.current_period_end) : null,
    ...(planId ? { plan_id: planId } : {}),
    ...(defaultPaymentMethod ? { default_payment_method_id: defaultPaymentMethod } : {}),
  });

  if (status === previousStatus) return;
  if (status === "past_due" || status === "unpaid") {
    await notifyCompany(db, companyId, {
      kind: "billing.past_due",
      title: "Payment problem",
      body: "Your subscription payment is past due. Update your card in Billing to keep posting shifts.",
      channels: ["push", "email"],
    });
  } else if (status === "canceled") {
    await notifyCompany(db, companyId, {
      kind: "billing.canceled",
      title: "Subscription ended",
      body: "Your ShiftShield plan has ended. Choose a plan to post shifts again.",
      channels: ["push", "email"],
    });
  }
}

async function onInvoicePaymentFailed(db: Db, invoice: Stripe.Invoice): Promise<void> {
  const company = await findCompanyByCustomer(db, idOf(invoice.customer));
  if (!company) return;
  await notifyCompany(db, company.id, {
    kind: "billing.payment_failed",
    title: "Subscription payment failed",
    body: "We couldn't charge your card for your ShiftShield plan. Update your payment method in Billing.",
    channels: ["push", "email"],
  });
}

async function onCustomerUpdated(customer: Stripe.Customer): Promise<void> {
  const pm = idOf(customer.invoice_settings?.default_payment_method);
  if (!pm) return;
  await internalUpdate("companies", { column: "stripe_customer_id", value: customer.id }, {
    default_payment_method_id: pm,
  });
}

async function onPaymentMethodAttached(db: Db, stripe: Stripe, pm: Stripe.PaymentMethod): Promise<void> {
  const customerId = idOf(pm.customer);
  if (!customerId) return;
  const { data: company, error } = await db
    .from("companies")
    .select("id, default_payment_method_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  if (!company || company.default_payment_method_id) return;
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
  await internalUpdate("companies", { column: "id", value: company.id }, { default_payment_method_id: pm.id });
}

// ---------- Connect ----------

async function onAccountUpdated(db: Db, account: Stripe.Account): Promise<void> {
  const { data: officer, error } = await db
    .from("officer_profiles")
    .select("user_id, payouts_enabled")
    .eq("stripe_account_id", account.id)
    .maybeSingle();
  if (error) throw error;
  if (!officer) return;
  const enabled = account.payouts_enabled === true;
  if (enabled === officer.payouts_enabled) return;
  await internalUpdate("officer_profiles", { column: "user_id", value: officer.user_id }, { payouts_enabled: enabled });
  if (enabled) {
    await notifyUser(db, officer.user_id, {
      kind: "payout.connected",
      title: "Payouts are set up",
      body: "You'll be paid automatically after each approved timesheet.",
    });
  }
}

// ---------- Shift charges ----------

async function onPaymentIntent(db: Db, intent: Stripe.PaymentIntent, outcome: "succeeded" | "failed"): Promise<void> {
  if (intent.metadata?.["kind"] !== "shift_charge") return;
  await recordPaymentIntentResult(db, intent, outcome);
}

async function onChargeRefunded(db: Db, charge: Stripe.Charge): Promise<void> {
  const intentId = idOf(charge.payment_intent);
  if (!intentId) return;
  const { data: payment, error } = await db
    .from("payments")
    .select("id, status, total_cents, refunded_cents")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();
  if (error) throw error;
  if (!payment || charge.amount_refunded <= payment.refunded_cents) return;

  const fullyRefunded = charge.amount_refunded >= payment.total_cents;
  const status = fullyRefunded ? "refunded" : payment.status === "paid_out" ? "partially_refunded" : payment.status;
  const { error: uErr } = await db
    .from("payments")
    .update({ refunded_cents: charge.amount_refunded, status })
    .eq("id", payment.id);
  if (uErr) throw uErr;
}
