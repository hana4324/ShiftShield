import { z } from "zod";
import type { ApproveTimesheetResponse } from "@shared/api.ts";
import { computeSettlement, shiftMinutes, type Settlement } from "@shared/money.ts";
import { internal } from "../_shared/errors.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { settleAssignment } from "../_shared/payments.ts";
import { isStripeError, stripeClient } from "../_shared/stripe.ts";
import { requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";
import { Uuid } from "../_shared/validation.ts";

const Body = z.object({
  assignment_id: Uuid,
  approved_minutes: z.number().int().min(0).max(24 * 60).optional(),
});

/**
 * Employer approves a timesheet. The RPC records approved minutes (capped at the scheduled
 * duration); then the officer is paid for approved minutes and the employer is refunded the rest.
 * If Stripe is unavailable after the approval persisted, reconcile-payments finishes the settlement.
 */
serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "employer_owner", "employer_manager", "admin");

  const { data: assignment, error } = await ctx.client.rpc("approve_timesheet", {
    p_assignment_id: body.assignment_id,
    p_approved_minutes: body.approved_minutes ?? null,
  });
  if (error) throw error;

  try {
    const outcome = await settleAssignment(serviceClient(), stripeClient(), assignment.id);
    const response: ApproveTimesheetResponse = {
      assignment_id: assignment.id,
      approved_minutes: outcome.approved_minutes,
      officer_payout_cents: outcome.settlement.officerPayoutCents,
      platform_fee_cents: outcome.settlement.platformFeeCents,
      refund_cents: outcome.settlement.refundCents,
      transfer_id: outcome.transfer_id,
      refund_id: outcome.refund_id,
    };
    return json(response);
  } catch (err) {
    if (!isStripeError(err)) throw err;
    // Approval is already committed; the reconciler retries the money movement.
    console.error("approve-timesheet: settlement deferred", assignment.id, err.type, err.code, err.message);
    const settlement = await previewSettlement(assignment.id, assignment.shift_id, assignment.approved_minutes ?? 0);
    const response: ApproveTimesheetResponse = {
      assignment_id: assignment.id,
      approved_minutes: assignment.approved_minutes ?? 0,
      officer_payout_cents: settlement.officerPayoutCents,
      platform_fee_cents: settlement.platformFeeCents,
      refund_cents: settlement.refundCents,
      transfer_id: null,
      refund_id: null,
    };
    return json(response, 202);
  }
});

async function previewSettlement(assignmentId: string, shiftId: string, approvedMinutes: number): Promise<Settlement> {
  const service = serviceClient();
  const [{ data: shift, error: sErr }, { data: payment, error: pErr }] = await Promise.all([
    service.from("shifts").select("start_at, end_at, hourly_rate_cents").eq("id", shiftId).maybeSingle(),
    service.from("payments").select("fee_bps").eq("assignment_id", assignmentId).maybeSingle(),
  ]);
  if (sErr) throw sErr;
  if (pErr) throw pErr;
  if (!shift || !payment) throw internal();
  return computeSettlement({
    hourlyRateCents: shift.hourly_rate_cents,
    chargedMinutes: shiftMinutes(new Date(shift.start_at), new Date(shift.end_at)),
    approvedMinutes,
    feeBps: payment.fee_bps,
  });
}
