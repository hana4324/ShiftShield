/**
 * Stripe side of the marketplace money flow. All DB state transitions that matter for the business
 * (assignment created, timesheet approved, cancellations) already happened inside the SQL RPCs;
 * these helpers move the money and record Stripe ids on `payments`.
 *
 * Money model (see packages/shared/src/money.ts):
 *   employer is charged officer pay + platform fee for the scheduled minutes at confirmation;
 *   on approval the officer is transferred pay for approved minutes, the employer is refunded
 *   the difference (pay + fee on unapproved minutes), and the fee on approved pay stays in the
 *   platform balance.
 */
import { computeSettlement, formatCents, shiftMinutes, type Settlement } from "@shared/money.ts";
import type { AssignmentRow, PaymentRow, ShiftRow } from "@shared/db/types.ts";
import { notFound } from "./errors.ts";
import { notifyCompany, notifyUser } from "./notify.ts";
import { Stripe, idOf, isStripeError } from "./stripe.ts";
import type { Db } from "./supabase.ts";

export type ClientPaymentStatus = "authorized" | "pending" | "failed";

export interface ChargeOutcome {
  status: ClientPaymentStatus;
  failure_message?: string;
  payment_intent_id: string | null;
}

interface AssignmentBundle {
  payment: PaymentRow;
  assignment: AssignmentRow;
  shift: ShiftRow;
}

async function loadBundle(db: Db, assignmentId: string): Promise<AssignmentBundle> {
  const { data: payment, error: pErr } = await db.from("payments").select("*").eq("assignment_id", assignmentId).maybeSingle();
  if (pErr) throw pErr;
  if (!payment) throw notFound("payment_not_found", "No payment record for this assignment.");
  const { data: assignment, error: aErr } = await db.from("assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (aErr) throw aErr;
  if (!assignment) throw notFound("assignment_not_found", "Assignment not found.");
  const { data: shift, error: sErr } = await db.from("shifts").select("*").eq("id", assignment.shift_id).maybeSingle();
  if (sErr) throw sErr;
  if (!shift) throw notFound("shift_not_found", "Shift not found.");
  return { payment, assignment, shift };
}

async function updatePayment(db: Db, paymentId: string, patch: Partial<PaymentRow>): Promise<void> {
  const { error } = await db.from("payments").update(patch).eq("id", paymentId);
  if (error) throw error;
}

async function markChargeFailed(
  db: Db,
  bundle: AssignmentBundle,
  message: string,
  paymentIntentId: string | null,
): Promise<ChargeOutcome> {
  const patch: Partial<PaymentRow> = { status: "failed", failure_message: message.slice(0, 500) };
  if (paymentIntentId) patch.stripe_payment_intent_id = paymentIntentId;
  await updatePayment(db, bundle.payment.id, patch);
  await notifyCompany(db, bundle.payment.company_id, {
    kind: "payment.failed",
    title: "Payment failed",
    body: `We couldn't charge your card for ${bundle.shift.title}: ${message} Update your payment method in Billing and we'll retry automatically.`,
    data: { assignment_id: bundle.assignment.id, shift_id: bundle.shift.id },
    channels: ["push", "email"],
  });
  return { status: "failed", failure_message: message, payment_intent_id: paymentIntentId };
}

/**
 * Charge the employer the full shift total (officer pay + platform fee) for a confirmed assignment.
 * Off-session PaymentIntent on the company's default payment method, captured automatically so the
 * money sits in the platform balance until the timesheet settles. Idempotent per payment attempt.
 */
export async function chargeAssignment(db: Db, stripe: Stripe, assignmentId: string): Promise<ChargeOutcome> {
  const bundle = await loadBundle(db, assignmentId);
  const { payment, assignment, shift } = bundle;

  switch (payment.status) {
    case "captured":
    case "paid_out":
    case "partially_refunded":
      return { status: "authorized", payment_intent_id: payment.stripe_payment_intent_id };
    case "authorized":
      return { status: "authorized", payment_intent_id: payment.stripe_payment_intent_id };
    case "canceled":
    case "refunded":
      return { status: "failed", failure_message: "This booking was cancelled.", payment_intent_id: payment.stripe_payment_intent_id };
    case "pending":
    case "failed":
      break;
  }
  if (payment.total_cents <= 0) {
    await updatePayment(db, payment.id, { status: "captured" });
    return { status: "authorized", payment_intent_id: null };
  }

  const { data: company, error: cErr } = await db
    .from("companies")
    .select("id, name, stripe_customer_id, default_payment_method_id")
    .eq("id", payment.company_id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!company?.stripe_customer_id || !company.default_payment_method_id) {
    return markChargeFailed(db, bundle, "No payment method on file.", null);
  }

  // First attempt is keyed on the payment id; retries after a failure are keyed on the failure's
  // timestamp so Stripe never replays the original declined response.
  const idempotencyKey = payment.status === "failed"
    ? `pi:${payment.id}:retry:${Date.parse(payment.updated_at) || payment.updated_at}`
    : `pi:${payment.id}:initial`;
  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: payment.total_cents,
        currency: "usd",
        customer: company.stripe_customer_id,
        payment_method: company.default_payment_method_id,
        off_session: true,
        confirm: true,
        capture_method: "automatic",
        transfer_group: assignment.id,
        description: `ShiftShield: ${shift.title} (${formatCents(payment.officer_pay_cents)} officer pay + ${formatCents(payment.platform_fee_cents)} platform fee)`,
        statement_descriptor_suffix: "SHIFT",
        metadata: {
          kind: "shift_charge",
          payment_id: payment.id,
          assignment_id: assignment.id,
          shift_id: shift.id,
          company_id: payment.company_id,
          officer_id: payment.officer_id,
        },
      },
      { idempotencyKey },
    );

    if (intent.status === "succeeded") {
      await updatePayment(db, payment.id, {
        status: "captured",
        stripe_payment_intent_id: intent.id,
        stripe_charge_id: idOf(intent.latest_charge),
        failure_message: null,
      });
      return { status: "authorized", payment_intent_id: intent.id };
    }
    if (intent.status === "processing" || intent.status === "requires_action" || intent.status === "requires_confirmation") {
      // The webhook (payment_intent.succeeded / payment_failed) finishes this one.
      await updatePayment(db, payment.id, { status: "pending", stripe_payment_intent_id: intent.id, failure_message: null });
      return { status: "pending", payment_intent_id: intent.id };
    }
    return markChargeFailed(db, bundle, `Payment could not be completed (${intent.status.replace(/_/g, " ")}).`, intent.id);
  } catch (err) {
    if (isStripeError(err)) {
      const intentId = err.payment_intent?.id ?? null;
      const message = err.type === "StripeCardError" ? err.message : "The payment provider rejected the charge.";
      if (err.type !== "StripeCardError") console.error("chargeAssignment stripe error", err.type, err.code, err.message);
      return markChargeFailed(db, bundle, message, intentId);
    }
    throw err;
  }
}

/** Record a PaymentIntent outcome reported by a webhook (idempotent). */
export async function recordPaymentIntentResult(
  db: Db,
  intent: Stripe.PaymentIntent,
  outcome: "succeeded" | "failed",
): Promise<void> {
  const paymentId = intent.metadata?.["payment_id"];
  const { data: payment, error } = paymentId
    ? await db.from("payments").select("*").eq("id", paymentId).maybeSingle()
    : await db.from("payments").select("*").eq("stripe_payment_intent_id", intent.id).maybeSingle();
  if (error) throw error;
  if (!payment) return;

  if (outcome === "succeeded") {
    if (payment.status !== "pending" && payment.status !== "failed") return;
    await updatePayment(db, payment.id, {
      status: "captured",
      stripe_payment_intent_id: intent.id,
      stripe_charge_id: idOf(intent.latest_charge),
      failure_message: null,
    });
    return;
  }
  if (payment.status !== "pending") return;
  const message = intent.last_payment_error?.message ?? "The payment was declined.";
  const bundle = await loadBundle(db, payment.assignment_id);
  await markChargeFailed(db, bundle, message, intent.id);
}

export interface SettleOutcome {
  settled: boolean;
  reason?: "not_approved" | "not_captured" | "payouts_not_enabled";
  settlement: Settlement;
  approved_minutes: number;
  transfer_id: string | null;
  refund_id: string | null;
}

/**
 * Settle an approved timesheet: transfer approved pay to the officer's Connect account
 * (source_transaction = the captured charge, transfer_group = assignment id) and refund the
 * employer for unapproved minutes. The platform fee on approved pay stays in the balance.
 *
 * If the officer cannot receive payouts yet, the refund still happens, the payment stays
 * 'captured', the officer is told to connect payouts, and reconcile-payments retries later.
 */
export interface SettleOptions {
  /** Skip the "connect your payout account" nudge (used by the periodic reconciler). */
  quiet?: boolean;
}

export async function settleAssignment(
  db: Db,
  stripe: Stripe,
  assignmentId: string,
  options: SettleOptions = {},
): Promise<SettleOutcome> {
  const { payment, assignment, shift } = await loadBundle(db, assignmentId);
  const approvedMinutes = assignment.approved_minutes ?? 0;
  const scheduledMinutes = shiftMinutes(new Date(shift.start_at), new Date(shift.end_at));
  const settlement = computeSettlement({
    hourlyRateCents: shift.hourly_rate_cents,
    chargedMinutes: scheduledMinutes,
    approvedMinutes,
    feeBps: payment.fee_bps,
  });
  const base = {
    settlement,
    approved_minutes: approvedMinutes,
    transfer_id: payment.stripe_transfer_id,
    refund_id: payment.stripe_refund_id,
  };

  if (assignment.approval_status !== "approved" && assignment.approval_status !== "auto_approved") {
    return { settled: false, reason: "not_approved", ...base };
  }
  if (payment.status === "paid_out" || payment.status === "refunded") {
    return { settled: true, ...base };
  }
  if (payment.status === "partially_refunded" && payment.stripe_transfer_id) {
    return { settled: true, ...base };
  }
  if (payment.status !== "captured" && payment.status !== "partially_refunded") {
    return { settled: false, reason: "not_captured", ...base };
  }
  if (!payment.stripe_payment_intent_id) {
    return { settled: false, reason: "not_captured", ...base };
  }

  let transferId = payment.stripe_transfer_id;
  let refundId = payment.stripe_refund_id;
  let refundedCents = payment.refunded_cents;
  let paidOutCents = payment.paid_out_cents;
  let payoutsBlocked = false;

  // 1. Officer payout (transfer first, so the amount is never constrained by a refund).
  if (settlement.officerPayoutCents > 0 && !transferId) {
    const { data: officer, error: oErr } = await db
      .from("officer_profiles")
      .select("stripe_account_id, payouts_enabled")
      .eq("user_id", payment.officer_id)
      .maybeSingle();
    if (oErr) throw oErr;
    if (!officer?.stripe_account_id || !officer.payouts_enabled) {
      payoutsBlocked = true;
      if (!options.quiet) await notifyUser(db, payment.officer_id, {
        kind: "payout.connect_required",
        title: "Connect your payout account",
        body: `${formatCents(settlement.officerPayoutCents)} for ${shift.title} is waiting. Finish payout setup in Profile to receive it.`,
        data: { assignment_id: assignment.id },
        channels: ["push", "email"],
      });
    } else {
      const transfer = await stripe.transfers.create(
        {
          amount: settlement.officerPayoutCents,
          currency: "usd",
          destination: officer.stripe_account_id,
          transfer_group: assignment.id,
          description: `ShiftShield pay: ${shift.title} (${approvedMinutes} min)`,
          metadata: {
            kind: "officer_payout",
            payment_id: payment.id,
            assignment_id: assignment.id,
            officer_id: payment.officer_id,
          },
          ...(payment.stripe_charge_id ? { source_transaction: payment.stripe_charge_id } : {}),
        },
        { idempotencyKey: `tr:${payment.id}` },
      );
      transferId = transfer.id;
      paidOutCents = settlement.officerPayoutCents;
      await updatePayment(db, payment.id, { stripe_transfer_id: transferId, paid_out_cents: paidOutCents });
    }
  }

  // 2. Employer refund for unapproved minutes (pay + fee).
  const refundDue = settlement.refundCents - refundedCents;
  if (refundDue > 0) {
    const refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        amount: refundDue,
        metadata: { kind: "timesheet_adjustment", payment_id: payment.id, assignment_id: assignment.id },
      },
      { idempotencyKey: `re:${payment.id}:${refundedCents}` },
    );
    refundId = refund.id;
    refundedCents += refundDue;
    await updatePayment(db, payment.id, { stripe_refund_id: refundId, refunded_cents: refundedCents });
  }

  // 3. Final status.
  const transferDone = settlement.officerPayoutCents === 0 || !!transferId;
  let status: PaymentRow["status"];
  if (!transferDone) {
    status = "captured";
  } else if (settlement.officerPayoutCents === 0 && refundedCents >= payment.total_cents) {
    status = "refunded";
  } else if (refundedCents > 0) {
    status = "partially_refunded";
  } else {
    status = "paid_out";
  }
  await updatePayment(db, payment.id, { status, paid_out_cents: paidOutCents, refunded_cents: refundedCents });

  if (payoutsBlocked) {
    return { settled: false, reason: "payouts_not_enabled", settlement, approved_minutes: approvedMinutes, transfer_id: transferId, refund_id: refundId };
  }
  return { settled: true, settlement, approved_minutes: approvedMinutes, transfer_id: transferId, refund_id: refundId };
}

/** Fully refund a captured payment whose assignment was cancelled / no-showed (status 'canceled'). */
export async function refundCanceledPayment(
  db: Db,
  stripe: Stripe,
  payment: PaymentRow,
): Promise<{ refund_id: string | null; refunded_cents: number }> {
  const remaining = payment.total_cents - payment.refunded_cents;
  if (!payment.stripe_payment_intent_id || !payment.stripe_charge_id) {
    return { refund_id: payment.stripe_refund_id, refunded_cents: payment.refunded_cents };
  }
  if (remaining <= 0) {
    await updatePayment(db, payment.id, { status: "refunded" });
    return { refund_id: payment.stripe_refund_id, refunded_cents: payment.refunded_cents };
  }
  const refund = await stripe.refunds.create(
    {
      payment_intent: payment.stripe_payment_intent_id,
      amount: remaining,
      metadata: { kind: "cancellation", payment_id: payment.id, assignment_id: payment.assignment_id },
    },
    { idempotencyKey: `re-cancel:${payment.id}:${payment.refunded_cents}` },
  );
  await updatePayment(db, payment.id, {
    status: "refunded",
    stripe_refund_id: refund.id,
    refunded_cents: payment.total_cents,
  });
  return { refund_id: refund.id, refunded_cents: payment.total_cents };
}
