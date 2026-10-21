import { z } from "zod";
import type { ConfirmApplicantResponse } from "@shared/api.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { chargeAssignment } from "../_shared/payments.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";
import { Uuid } from "../_shared/validation.ts";

const Body = z.object({ application_id: Uuid });

/**
 * Employer confirms an applicant (review mode). The RPC creates the assignment + pending payment
 * under a row lock; then the employer's saved card is charged for the shift total.
 */
serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "employer_owner", "employer_manager", "admin");

  const { data: assignment, error } = await ctx.client.rpc("confirm_applicant", {
    p_application_id: body.application_id,
  });
  if (error) throw error;

  const charge = await chargeAssignment(serviceClient(), stripeClient(), assignment.id);
  const response: ConfirmApplicantResponse = {
    assignment_id: assignment.id,
    payment_status: charge.status,
    ...(charge.failure_message ? { failure_message: charge.failure_message } : {}),
  };
  return json(response);
});
