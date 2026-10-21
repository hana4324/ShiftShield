import { z } from "zod";
import type { InviteManagerResponse } from "@shared/api.ts";
import { escapeHtml, isEmailConfigured, sendEmail } from "../_shared/email.ts";
import { appUrl } from "../_shared/env.ts";
import { conflict, notFound } from "../_shared/errors.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { requireCompany, requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(320) });

/** Escape LIKE wildcards so ilike() is an exact case-insensitive match. */
function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Owner invites a manager. Seat caps are enforced again by accept_company_invite on accept;
 * we check company_usage() up front so the owner gets the upgrade prompt immediately.
 */
serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "employer_owner");
  const companyId = requireCompany(ctx);

  const { data: usage, error: uErr } = await ctx.client.rpc("company_usage", { p_company_id: companyId });
  if (uErr) throw uErr;
  if (usage.seat_cap !== null && usage.seats_used >= usage.seat_cap) {
    throw conflict(
      "plan_cap_seats",
      `Your ${usage.plan_name} plan allows ${usage.seat_cap} manager seats. Upgrade to invite more.`,
    );
  }

  const service = serviceClient();
  const { data: company, error: cErr } = await service.from("companies").select("name").eq("id", companyId).maybeSingle();
  if (cErr) throw cErr;
  if (!company) throw notFound("company_not_found", "Company not found.");

  // Already on a team?
  const { data: profiles, error: pErr } = await service.from("profiles").select("id").ilike("email", likeLiteral(body.email));
  if (pErr) throw pErr;
  const profileIds = (profiles ?? []).map((p) => p.id);
  if (profileIds.length > 0) {
    const { data: members, error: mErr } = await service.from("company_members").select("user_id, company_id").in("user_id", profileIds);
    if (mErr) throw mErr;
    if ((members ?? []).some((m) => m.company_id === companyId)) {
      throw conflict("already_member", "That person is already on your team.");
    }
    if ((members ?? []).length > 0) {
      throw conflict("already_member", "That person already belongs to another company.");
    }
  }

  // Reuse a live pending invite rather than minting a second token.
  const nowIso = new Date().toISOString();
  const { data: pending, error: iErr } = await service
    .from("company_invites")
    .select("*")
    .eq("company_id", companyId)
    .ilike("email", likeLiteral(body.email))
    .is("accepted_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (iErr) throw iErr;

  let invite = pending;
  if (!invite) {
    const { data: created, error: insErr } = await service
      .from("company_invites")
      .insert({ company_id: companyId, email: body.email, role: "manager", invited_by: ctx.user.id })
      .select("*")
      .single();
    if (insErr) throw insErr;
    invite = created;
  }

  const link = `${appUrl()}/invite/${invite.token}`;
  const inviter = ctx.user.user_metadata?.["full_name"];
  const inviterName = typeof inviter === "string" && inviter.trim() ? inviter.trim() : "The owner";
  const result = await sendEmail({
    to: body.email,
    subject: `${company.name} invited you to ShiftShield`,
    text: `${inviterName} invited you to manage shifts for ${company.name} on ShiftShield.\n\nAccept the invite: ${link}\n\nThis link expires ${new Date(invite.expires_at).toUTCString()}.`,
    html: `<p>${escapeHtml(inviterName)} invited you to manage shifts for <strong>${escapeHtml(company.name)}</strong> on ShiftShield.</p>` +
      `<p><a href="${escapeHtml(link)}">Accept the invite</a></p>` +
      `<p style="color:#6b7280">This link expires ${escapeHtml(new Date(invite.expires_at).toUTCString())}.</p>`,
  });
  if (!result.ok && !result.skipped) console.error("invite-manager: email failed", result.error);
  if (!isEmailConfigured()) console.warn("invite-manager: RESEND_API_KEY not set; invite", invite.id, "was not emailed");

  const response: InviteManagerResponse = { invite_id: invite.id, expires_at: invite.expires_at };
  return json(response);
});
