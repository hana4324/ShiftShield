import { z } from "zod";
import type { ClockOutResponse } from "@shared/api.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { requireRole, requireUser } from "../_shared/supabase.ts";
import { Coordinate, Uuid } from "../_shared/validation.ts";

const Body = Coordinate.extend({
  assignment_id: Uuid,
  notes: z.string().trim().max(2000).optional(),
});

/** Clock-out. The RPC records the timesheet and notifies the employer to approve it. */
serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "officer");

  const { data, error } = await ctx.client.rpc("clock_out", {
    p_assignment_id: body.assignment_id,
    p_lat: body.lat,
    p_lng: body.lng,
    p_accuracy_m: body.accuracy_m ?? null,
    p_notes: body.notes ?? null,
  });
  if (error) throw error;

  const response: ClockOutResponse = data;
  return json(response);
});
