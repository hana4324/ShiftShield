import type { PaymentRow } from "@shared/db/types.ts";
import { json, serve } from "../_shared/http.ts";
import { chargeAssignment, refundCanceledPayment, settleAssignment } from "../_shared/payments.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { type Db, isServiceRequest, requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";

const BATCH = 100;
/** A failed charge is retried on its own after this long even if the card didn't change. */
const RETRY_AFTER_MS = 12 * 60 * 60 * 1000;

interface Summary {
  refunded: number;
  settled: number;
  awaiting_payouts: number;
  charged: number;
  charge_failed: number;
  skipped: number;
  errors: number;
}

/**
 * Periodic money reconciler (pg_cron every 10 minutes with the service key; admins may trigger it).
 *  1. cancelled / no-show payments that were captured -> full refund
 *  2. captured payments whose timesheet is approved (incl. auto-approved by cron) -> settle
 *  3. failed charges for still-confirmed assignments -> retry once the card is updated
 */
serve(async (req) => {
  if (!isServiceRequest(req)) {
    const ctx = await requireUser(req);
    requireRole(ctx, "admin");
  }
  const db = serviceClient();
  const stripe = stripeClient();
  const summary: Summary = { refunded: 0, settled: 0, awaiting_payouts: 0, charged: 0, charge_failed: 0, skipped: 0, errors: 0 };

  await refundCancellations(db, summary);
  await settleApproved(db, summary);
  await retryFailedCharges(db, summary);

  return json(summary);

  async function refundCancellations(db: Db, s: Summary): Promise<void> {
    const { data, error } = await db
      .from("payments")
      .select("*")
      .eq("status", "canceled")
      .not("stripe_charge_id", "is", null)
      .order("updated_at", { ascending: true })
      .limit(BATCH);
    if (error) throw error;
    for (const payment of data ?? []) {
      if (payment.refunded_cents >= payment.total_cents) {
        s.skipped += 1;
        continue;
      }
      try {
        await refundCanceledPayment(db, stripe, payment);
        s.refunded += 1;
      } catch (err) {
        s.errors += 1;
        console.error("reconcile: refund failed", payment.id, err instanceof Error ? err.message : err);
      }
    }
  }

  async function settleApproved(db: Db, s: Summary): Promise<void> {
    const { data, error } = await db
      .from("payments")
      .select("*")
      .eq("status", "captured")
      .is("stripe_transfer_id", null)
      .order("updated_at", { ascending: true })
      .limit(BATCH);
    if (error) throw error;
    const payments = data ?? [];
    if (payments.length === 0) return;

    const { data: assignments, error: aErr } = await db
      .from("assignments")
      .select("id, approval_status")
      .in("id", payments.map((p) => p.assignment_id))
      .in("approval_status", ["approved", "auto_approved"]);
    if (aErr) throw aErr;
    const approved = new Set((assignments ?? []).map((a) => a.id));

    for (const payment of payments) {
      if (!approved.has(payment.assignment_id)) {
        s.skipped += 1;
        continue;
      }
      try {
        const outcome = await settleAssignment(db, stripe, payment.assignment_id, { quiet: true });
        if (outcome.settled) s.settled += 1;
        else if (outcome.reason === "payouts_not_enabled") s.awaiting_payouts += 1;
        else s.skipped += 1;
      } catch (err) {
        s.errors += 1;
        console.error("reconcile: settlement failed", payment.id, err instanceof Error ? err.message : err);
      }
    }
  }

  async function retryFailedCharges(db: Db, s: Summary): Promise<void> {
    const { data, error } = await db
      .from("payments")
      .select("*")
      .eq("status", "failed")
      .order("updated_at", { ascending: true })
      .limit(BATCH);
    if (error) throw error;
    const payments: PaymentRow[] = data ?? [];
    if (payments.length === 0) return;

    const [{ data: assignments, error: aErr }, { data: companies, error: cErr }] = await Promise.all([
      db.from("assignments").select("id, status").in("id", payments.map((p) => p.assignment_id)).eq("status", "confirmed"),
      db
        .from("companies")
        .select("id, stripe_customer_id, default_payment_method_id, updated_at")
        .in("id", [...new Set(payments.map((p) => p.company_id))]),
    ]);
    if (aErr) throw aErr;
    if (cErr) throw cErr;
    const confirmed = new Set((assignments ?? []).map((a) => a.id));
    const companyById = new Map((companies ?? []).map((c) => [c.id, c] as const));
    const now = Date.now();

    for (const payment of payments) {
      const company = companyById.get(payment.company_id);
      if (!confirmed.has(payment.assignment_id) || !company?.stripe_customer_id || !company.default_payment_method_id) {
        s.skipped += 1;
        continue;
      }
      const failedAt = Date.parse(payment.updated_at);
      const cardUpdatedSince = Date.parse(company.updated_at) > failedAt;
      const staleEnough = now - failedAt > RETRY_AFTER_MS;
      if (!cardUpdatedSince && !staleEnough) {
        s.skipped += 1;
        continue;
      }
      try {
        const outcome = await chargeAssignment(db, stripe, payment.assignment_id);
        if (outcome.status === "authorized") s.charged += 1;
        else if (outcome.status === "failed") s.charge_failed += 1;
        else s.skipped += 1;
      } catch (err) {
        s.errors += 1;
        console.error("reconcile: charge retry failed", payment.id, err instanceof Error ? err.message : err);
      }
    }
  }
});
