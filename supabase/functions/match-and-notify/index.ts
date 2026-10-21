import { z } from "zod";
import type { MatchAndNotifyResponse } from "@shared/api.ts";
import { formatCents } from "@shared/money.ts";
import { forbidden, notFound } from "../_shared/errors.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { type NotifyChannel, notifyUsers } from "../_shared/notify.ts";
import { isServiceRequest, requireUser, serviceClient } from "../_shared/supabase.ts";
import { Uuid } from "../_shared/validation.ts";

const Body = z.object({ shift_id: Uuid });
const MAX_CANDIDATES = 50;

/**
 * Find eligible officers near a shift and notify them. Callable by internal jobs (service key),
 * admins, or the owner of the company that posted the shift.
 */
serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = isServiceRequest(req) ? null : await requireUser(req);
  const service = serviceClient();

  const { data: shift, error: sErr } = await service
    .from("shifts")
    .select("id, company_id, site_id, title, hourly_rate_cents, is_urgent, status")
    .eq("id", body.shift_id)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!shift) throw notFound("shift_not_found", "Shift not found.");

  if (ctx) {
    const isAdmin = ctx.claims.app_role === "admin";
    const isOwner = ctx.claims.app_role === "employer_owner" && ctx.claims.company_id === shift.company_id;
    if (!isAdmin && !isOwner) throw forbidden();
  }

  if (shift.status !== "open") {
    const response: MatchAndNotifyResponse = { candidates: 0, notified: 0, sms_queued: 0 };
    return json(response);
  }

  const [{ data: site, error: siteErr }, { data: candidates, error: mErr }] = await Promise.all([
    service.from("sites").select("name").eq("id", shift.site_id).maybeSingle(),
    service.rpc("match_candidates", { p_shift_id: shift.id }),
  ]);
  if (siteErr) throw siteErr;
  if (mErr) throw mErr;

  const all = candidates ?? [];
  const selected = all.slice(0, MAX_CANDIDATES).map((c) => c.officer_id);
  const channels: NotifyChannel[] = shift.is_urgent ? ["push", "sms"] : ["push"];
  const notified = await notifyUsers(service, selected, {
    kind: "shift.match",
    title: shift.is_urgent ? "Urgent shift nearby" : "New shift nearby",
    body: `New shift nearby: ${shift.title} at ${site?.name ?? "a site near you"}, ${formatCents(shift.hourly_rate_cents)}/hr`,
    data: { shift_id: shift.id, urgent: shift.is_urgent },
    channels,
  });

  const response: MatchAndNotifyResponse = {
    candidates: all.length,
    notified,
    sms_queued: shift.is_urgent ? notified : 0,
  };
  return json(response);
});
