import { z } from "zod";
import type { BackgroundCheckResponse } from "@shared/api.ts";
import {
  type BackgroundCheckState,
  refreshBackgroundCheck,
  setBackgroundStatus,
  startBackgroundCheck,
} from "../_shared/background-check.ts";
import { badRequest, conflict, forbidden, notFound } from "../_shared/errors.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";
import { Uuid } from "../_shared/validation.ts";

const Body = z.object({
  action: z.enum(["start", "status", "manual_set"]),
  officer_id: Uuid.optional(),
  status: z.enum(["not_started", "pending", "clear", "consider", "failed"]).optional(),
  reference: z.string().trim().max(200).optional(),
});

/**
 * Background check entry point. Officers act on themselves; admins may target any officer and
 * set results manually (manual provider). Provider is chosen by BACKGROUND_CHECK_PROVIDER.
 */
serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  const isAdmin = ctx.claims.app_role === "admin";
  const target = body.officer_id ?? ctx.user.id;
  if (target !== ctx.user.id && !isAdmin) throw forbidden();
  if (!isAdmin) requireRole(ctx, "officer");

  const service = serviceClient();
  let state: BackgroundCheckState;

  switch (body.action) {
    case "manual_set": {
      if (!isAdmin) throw forbidden("Only admins can set background check results.");
      if (!body.status) throw badRequest("status_required", "manual_set requires a status.");
      state = await setBackgroundStatus(service, target, body.status, "manual", body.reference ?? null);
      break;
    }
    case "start": {
      const { data: op, error } = await service
        .from("officer_profiles")
        .select("signup_fee_paid_at, background_status, background_provider, background_reference")
        .eq("user_id", target)
        .maybeSingle();
      if (error) throw error;
      if (!op) throw notFound("officer_profile_required", "Complete your officer profile first.");
      if (!op.signup_fee_paid_at && !isAdmin) {
        throw conflict("signup_fee_required", "Pay the signup fee to start your background check.");
      }
      if (op.background_status === "pending" || op.background_status === "clear") {
        state = {
          provider: op.background_provider ?? "manual",
          status: op.background_status,
          reference: op.background_reference,
        };
        break;
      }
      state = await startBackgroundCheck(service, target);
      break;
    }
    case "status": {
      state = await refreshBackgroundCheck(service, target);
      break;
    }
  }

  const response: BackgroundCheckResponse = state;
  return json(response);
});
