import { z } from "zod";
import type { AcceptShiftResponse } from "@shared/api.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { chargeAssignment } from "../_shared/payments.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";
import { Uuid } from "../_shared/validation.ts";

const Body = z.object({
  shift_id: Uuid,
  message: z.string().trim().max(500).optional(),
});

/**
 * Officer taps Accept. The RPC books (auto-fill) or applies (review mode) under a row lock.
 * On a booking, the employer is charged the shift total immediately.
 */
serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "officer");

  const { data, error } = await ctx.client.rpc("accept_shift", {
    p_shift_id: body.shift_id,
    p_message: body.message ?? null,
  });
  if (error) throw error;

  if (data.outcome === "applied") {
    const response: AcceptShiftResponse = { outcome: "applied", application_id: data.application_id };
    return json(response);
  }

  const charge = await chargeAssignment(serviceClient(), stripeClient(), data.assignment_id);
  const response: AcceptShiftResponse = {
    outcome: "booked",
    assignment_id: data.assignment_id,
    payment_status: charge.status,
  };
  return json(response);
});
