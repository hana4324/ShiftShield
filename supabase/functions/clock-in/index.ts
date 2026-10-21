import type { ClockInResponse } from "@shared/api.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { requireRole, requireUser } from "../_shared/supabase.ts";
import { Coordinate, Uuid } from "../_shared/validation.ts";

const Body = Coordinate.extend({ assignment_id: Uuid });

/** Geofenced clock-in. All rules (early window, radius, override) live in the clock_in RPC. */
serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "officer");

  const { data, error } = await ctx.client.rpc("clock_in", {
    p_assignment_id: body.assignment_id,
    p_lat: body.lat,
    p_lng: body.lng,
    p_accuracy_m: body.accuracy_m ?? null,
  });
  if (error) throw error;

  const response: ClockInResponse = data;
  return json(response);
});
