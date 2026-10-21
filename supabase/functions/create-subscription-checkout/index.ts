import { z } from "zod";
import type { CreateSubscriptionCheckoutResponse } from "@shared/api.ts";
import { BUSINESS } from "@shared/constants/business.ts";
import { PILOT_TRIAL_DAYS } from "@shared/constants/plans.ts";
import { Stripe } from "../_shared/stripe.ts";
import { internalUpdate } from "../_shared/db.ts";
import { env } from "../_shared/env.ts";
import { conflict, internal, notFound } from "../_shared/errors.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { getSettingInt } from "../_shared/settings.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { requireCompany, requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";
import { RedirectUrl } from "../_shared/validation.ts";

const Body = z.object({
  plan_code: z.enum(["essential", "pro", "enterprise"]),
  success_url: RedirectUrl,
  cancel_url: RedirectUrl,
});

serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "employer_owner");
  const companyId = requireCompany(ctx);

  const service = serviceClient();
  const [{ data: company, error: cErr }, { data: plan, error: pErr }] = await Promise.all([
    service.from("companies").select("*").eq("id", companyId).maybeSingle(),
    service.from("plans").select("*").eq("code", body.plan_code).eq("is_active", true).maybeSingle(),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;
  if (!company) throw notFound("company_not_found", "Company not found.");
  if (!plan) throw notFound("plan_not_found", "That plan is not available.");
  if (company.stripe_subscription_id && (company.subscription_status === "active" || company.subscription_status === "trialing")) {
    throw conflict("already_subscribed", "You already have an active plan. Change it from the billing portal.");
  }

  const stripe = stripeClient();

  // Reuse the Stripe customer or create one and remember it.
  let customerId = company.stripe_customer_id;
  if (!customerId) {
    const email = company.billing_email ?? ctx.user.email ?? null;
    const customer = await stripe.customers.create(
      {
        name: company.name,
        ...(email ? { email } : {}),
        ...(company.phone ? { phone: company.phone } : {}),
        description: `ShiftShield employer (${company.type})`,
        metadata: {
          company_id: company.id,
          company_type: company.type,
          owner_user_id: ctx.user.id,
          platform: BUSINESS.legalName,
          platform_address: BUSINESS.address.full,
          platform_phone: BUSINESS.phoneE164,
        },
      },
      { idempotencyKey: `customer:${company.id}` },
    );
    customerId = customer.id;
    await internalUpdate("companies", { column: "id", value: company.id }, { stripe_customer_id: customerId });
  }

  const trialDays = company.is_pilot ? await getSettingInt(service, "pilot_trial_days", PILOT_TRIAL_DAYS) : 0;

  const envPriceId = env(`STRIPE_PRICE_${body.plan_code.toUpperCase()}`);
  const priceId = plan.stripe_price_id ?? envPriceId ?? null;
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: plan.price_cents,
        recurring: { interval: "month" },
        product_data: { name: `ShiftShield ${plan.name}`, description: `${plan.name} plan, billed monthly.` },
      },
    };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: company.id,
    line_items: [lineItem],
    payment_method_collection: "always",
    allow_promotion_codes: true,
    success_url: body.success_url,
    cancel_url: body.cancel_url,
    metadata: { company_id: company.id, plan_code: body.plan_code },
    subscription_data: {
      metadata: { company_id: company.id, plan_code: body.plan_code },
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
  });
  if (!session.url) throw internal("Stripe did not return a checkout URL.");

  const response: CreateSubscriptionCheckoutResponse = {
    checkout_url: session.url,
    session_id: session.id,
    trial_days: trialDays,
  };
  return json(response);
});
