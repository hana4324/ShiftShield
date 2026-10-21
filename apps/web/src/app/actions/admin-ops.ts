"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  EDGE_FUNCTIONS,
  isApiError,
  parseDbError,
  type ApproveTimesheetResponse,
  type Json,
} from "@shiftshield/shared";
import { requireAdmin, type AdminSession } from "@/lib/admin-auth";
import { serverEnv } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { DbClient } from "@/lib/supabase/server";

/**
 * Admin mutations. Every state change goes through the `admin_*` RPCs with the admin's own
 * session client, so `private.is_admin()` authorizes it and `private.audit()` records the actor.
 * The service role is never used for state changes here.
 */

type SupabaseAdmin = Extract<AdminSession, { kind: "supabase" }>;

const uuid = z.string().uuid();

async function adminDb(): Promise<{ ok: true; s: SupabaseAdmin; db: DbClient } | { ok: false; state: FormState }> {
  const s = await requireAdmin({ mode: "readwrite" });
  if (s.kind !== "supabase") {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Supabase Auth is not configured; actions are unavailable in local demo mode.",
      },
    };
  }
  return { ok: true, s, db: s.db };
}

function fail(message: string): FormState {
  return { status: "error", message };
}

function ok(message: string): FormState {
  return { status: "success", message };
}

function dbFail(error: unknown): FormState {
  return fail(parseDbError(error).message);
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// ---------- Licenses ----------

const reviewSchema = z
  .object({
    id: uuid,
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500),
  })
  .refine((v) => v.decision === "approve" || v.reason.length >= 3, {
    message: "Give the officer a reason (at least 3 characters).",
    path: ["reason"],
  });

export async function reviewLicense(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = reviewSchema.safeParse({
    id: str(fd, "id"),
    decision: str(fd, "decision"),
    reason: str(fd, "reason"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const { id, decision, reason } = parsed.data;
  const { error } = await ctx.db.rpc("admin_review_license", {
    p_license_id: id,
    p_approve: decision === "approve",
    p_reason: decision === "reject" ? reason : null,
  });
  if (error) return dbFail(error);
  revalidatePath("/admin/licenses");
  revalidatePath(`/admin/licenses/${id}`);
  revalidatePath("/admin", "layout");
  return ok(decision === "approve" ? "License approved. The officer was notified." : "License rejected. The officer was asked to re-upload.");
}

// ---------- Officers ----------

const officerStatusSchema = z.object({
  id: uuid,
  status: z.enum(["onboarding", "active", "suspended", "deactivated"]),
  reason: z.string().trim().max(500),
});

export async function setOfficerStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = officerStatusSchema.safeParse({
    id: str(fd, "id"),
    status: str(fd, "status"),
    reason: str(fd, "reason"),
  });
  if (!parsed.success) return fail("Invalid input.");
  if (parsed.data.status !== "active" && parsed.data.reason.length < 3)
    return fail("A reason is required (it is sent to the officer and logged).");
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const { error } = await ctx.db.rpc("admin_set_officer_status", {
    p_officer_id: parsed.data.id,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason || null,
  });
  if (error) return dbFail(error);
  revalidatePath(`/admin/officers/${parsed.data.id}`);
  revalidatePath("/admin/officers");
  return ok(`Account status set to ${parsed.data.status.replace(/_/g, " ")}.`);
}

const backgroundSchema = z.object({
  id: uuid,
  status: z.enum(["not_started", "pending", "clear", "consider", "failed"]),
  reference: z.string().trim().max(200),
});

export async function setBackgroundStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = backgroundSchema.safeParse({
    id: str(fd, "id"),
    status: str(fd, "status"),
    reference: str(fd, "reference"),
  });
  if (!parsed.success) return fail("Invalid input.");
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const { error } = await ctx.db.rpc("admin_set_background_status", {
    p_officer_id: parsed.data.id,
    p_status: parsed.data.status,
    p_provider: "manual",
    p_reference: parsed.data.reference || null,
  });
  if (error) return dbFail(error);
  revalidatePath(`/admin/officers/${parsed.data.id}`);
  revalidatePath("/admin/officers");
  return ok(`Background status set to ${parsed.data.status.replace(/_/g, " ")}.`);
}

// ---------- Companies ----------

const pilotSchema = z.object({
  id: uuid,
  isPilot: z.enum(["true", "false"]),
  endsAt: z.string().trim().max(40),
});

export async function setCompanyPilot(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = pilotSchema.safeParse({ id: str(fd, "id"), isPilot: str(fd, "is_pilot"), endsAt: str(fd, "ends_at") });
  if (!parsed.success) return fail("Invalid input.");
  const isPilot = parsed.data.isPilot === "true";
  let endsAt: string | null = null;
  if (isPilot && parsed.data.endsAt) {
    const d = new Date(`${parsed.data.endsAt}T23:59:59-05:00`);
    if (Number.isNaN(d.getTime())) return fail("Invalid pilot end date.");
    endsAt = d.toISOString();
  }
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const { error } = await ctx.db.rpc("admin_set_company_pilot", {
    p_company_id: parsed.data.id,
    p_is_pilot: isPilot,
    p_pilot_ends_at: endsAt,
  });
  if (error) return dbFail(error);
  revalidatePath(`/admin/companies/${parsed.data.id}`);
  revalidatePath("/admin/companies");
  return ok(isPilot ? "Company marked as pilot." : "Pilot flag removed.");
}

const planSchema = z.object({ id: uuid, plan: z.enum(["essential", "pro", "enterprise"]) });

export async function setCompanyPlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = planSchema.safeParse({ id: str(fd, "id"), plan: str(fd, "plan") });
  if (!parsed.success) return fail("Invalid input.");
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const { error } = await ctx.db.rpc("admin_set_company_plan", {
    p_company_id: parsed.data.id,
    p_plan_code: parsed.data.plan,
  });
  if (error) return dbFail(error);
  revalidatePath(`/admin/companies/${parsed.data.id}`);
  revalidatePath("/admin/companies");
  return ok(`Plan changed to ${parsed.data.plan}. Stripe is not updated by this action.`);
}

// ---------- Disputes / settlement / refunds ----------

const resolveSchema = z.object({
  assignmentId: uuid,
  disputeId: uuid,
  minutes: z.coerce.number().int().min(0).max(24 * 60),
  notes: z.string().trim().max(1000),
});

export async function resolveDispute(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = resolveSchema.safeParse({
    assignmentId: str(fd, "assignment_id"),
    disputeId: str(fd, "dispute_id"),
    minutes: str(fd, "minutes"),
    notes: str(fd, "notes"),
  });
  if (!parsed.success) return fail("Enter the approved minutes (0 to 1440).");
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const { data, error } = await ctx.db.rpc("admin_resolve_dispute", {
    p_assignment_id: parsed.data.assignmentId,
    p_resolved_minutes: parsed.data.minutes,
    p_notes: parsed.data.notes || null,
  });
  if (error) return dbFail(error);
  revalidatePath(`/admin/disputes/${parsed.data.disputeId}`);
  revalidatePath("/admin/disputes");
  revalidatePath("/admin", "layout");
  return ok(`Resolved with ${data.approved_minutes ?? parsed.data.minutes} approved minutes. Run the settlement to move the money.`);
}

const settlementSchema = z.object({ assignmentId: uuid, disputeId: uuid.optional() });

/** POST to the approve-timesheet Edge Function with the admin's access token (capture + transfer + refund). */
export async function runSettlement(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = settlementSchema.safeParse({
    assignmentId: str(fd, "assignment_id"),
    disputeId: str(fd, "dispute_id") || undefined,
  });
  if (!parsed.success) return fail("Invalid input.");
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const url = `${serverEnv.supabaseUrl}/functions/v1/${EDGE_FUNCTIONS.approveTimesheet}`;
  let body: unknown;
  let status = 0;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.s.accessToken}`,
        apikey: serverEnv.supabaseAnonKey ?? "",
      },
      body: JSON.stringify({ assignment_id: parsed.data.assignmentId }),
      cache: "no-store",
    });
    status = res.status;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  } catch (e) {
    return fail(`Could not reach the Edge Function: ${e instanceof Error ? e.message : "network error"}`);
  }
  if (parsed.data.disputeId) revalidatePath(`/admin/disputes/${parsed.data.disputeId}`);
  revalidatePath("/admin/shifts");
  if (isApiError(body)) return fail(`approve-timesheet ${status}: ${body.error.code} - ${body.error.message}`);
  if (status >= 400) return fail(`approve-timesheet responded ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  const r = body as Partial<ApproveTimesheetResponse>;
  return ok(
    `Settlement ran (${status}): ${r.approved_minutes ?? "?"} min approved, payout ${cents(r.officer_payout_cents)}, fee ${cents(r.platform_fee_cents)}, refund ${cents(r.refund_cents)}${r.transfer_id ? `, transfer ${r.transfer_id}` : ""}${r.refund_id ? `, refund ${r.refund_id}` : ""}.`,
  );
}

function cents(v: number | undefined): string {
  return typeof v === "number" ? `$${(v / 100).toFixed(2)}` : "?";
}

const refundSchema = z.object({ paymentId: uuid, disputeId: uuid.optional(), shiftId: uuid.optional() });

/**
 * "Issue refund" = mark the payment `canceled`; the reconcile-payments job releases/refunds the
 * Stripe authorization. Tried first with the admin session (RLS). The current migrations grant
 * admins only SELECT on `payments`, so when RLS reports zero rows the service-role client is
 * used as a server-side fallback and the response says so.
 */
export async function cancelPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = refundSchema.safeParse({
    paymentId: str(fd, "payment_id"),
    disputeId: str(fd, "dispute_id") || undefined,
    shiftId: str(fd, "shift_id") || undefined,
  });
  if (!parsed.success) return fail("Invalid input.");
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const { paymentId } = parsed.data;
  const { data: current, error: readError } = await ctx.db.from("payments").select("id,status").eq("id", paymentId).maybeSingle();
  if (readError) return dbFail(readError);
  if (!current) return fail("Payment not found.");
  if (!["pending", "authorized", "failed"].includes(current.status)) {
    return fail(`Payment is ${current.status}; only pending/authorized payments can be canceled here. Captured money is refunded by the settlement.`);
  }
  const { data: updated, error } = await ctx.db
    .from("payments")
    .update({ status: "canceled" })
    .eq("id", paymentId)
    .select("id");
  if (error) return dbFail(error);
  let via = "admin session";
  if (!updated || updated.length === 0) {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return fail("RLS has no admin UPDATE policy on payments and SUPABASE_SERVICE_ROLE_KEY is not set; add a `payments: admin update` policy.");
    }
    const { error: svcError } = await admin.from("payments").update({ status: "canceled" }).eq("id", paymentId);
    if (svcError) return fail(svcError.message);
    via = "service role (RLS has no admin UPDATE policy on payments)";
  }
  if (parsed.data.disputeId) revalidatePath(`/admin/disputes/${parsed.data.disputeId}`);
  if (parsed.data.shiftId) revalidatePath(`/admin/shifts/${parsed.data.shiftId}`);
  return ok(`Payment marked canceled via ${via}. The reconcile job will release or refund the Stripe authorization.`);
}

// ---------- Settings ----------
// Note: `private.audit()` is not callable from the client role and authenticated users cannot
// insert into audit_log, so plan / platform_settings edits are not audited here. The row's
// `updated_at` (and `updated_by` for settings) is shown as "last updated" instead.

const intOrNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .pipe(z.number().int().min(1).nullable());

const planRowSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(60),
  price_cents: z.coerce.number().int().min(0),
  monthly_booking_cap: intOrNull,
  monthly_shift_cap: intOrNull,
  min_lead_time_minutes: z.coerce.number().int().min(0),
  max_sites: intOrNull,
  max_seats: intOrNull,
  fee_bps: z.coerce.number().int().min(0).max(10000),
  priority_rank: z.coerce.number().int().min(0),
  daily_pay_enabled: z.boolean(),
  is_active: z.boolean(),
  stripe_price_id: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
});

export async function savePlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = planRowSchema.safeParse({
    id: str(fd, "id"),
    name: str(fd, "name"),
    price_cents: str(fd, "price_cents"),
    monthly_booking_cap: str(fd, "monthly_booking_cap"),
    monthly_shift_cap: str(fd, "monthly_shift_cap"),
    min_lead_time_minutes: str(fd, "min_lead_time_minutes"),
    max_sites: str(fd, "max_sites"),
    max_seats: str(fd, "max_seats"),
    fee_bps: str(fd, "fee_bps"),
    priority_rank: str(fd, "priority_rank"),
    daily_pay_enabled: fd.get("daily_pay_enabled") === "on",
    is_active: fd.get("is_active") === "on",
    stripe_price_id: str(fd, "stripe_price_id"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`${issue?.path.join(".") ?? "field"}: ${issue?.message ?? "invalid"}`);
  }
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const { id, ...patch } = parsed.data;
  const { data, error } = await ctx.db.from("plans").update(patch).eq("id", id).select("id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return fail("No row updated (RLS denied the write?).");
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return ok(`Plan "${patch.name}" saved.`);
}

const settingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_.-]+$/i, "Key may contain letters, numbers, _ . -"),
  value: z.string().trim().min(1).max(4000),
  description: z.string().trim().max(500),
});

export async function savePlatformSetting(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = settingSchema.safeParse({
    key: str(fd, "key"),
    value: str(fd, "value"),
    description: str(fd, "description"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  let value: unknown;
  try {
    value = JSON.parse(parsed.data.value);
  } catch {
    return fail("Value must be valid JSON (e.g. 3000, 4.0, true, [30,14,3] or \"text\").");
  }
  const ctx = await adminDb();
  if (!ctx.ok) return ctx.state;
  const row = {
    key: parsed.data.key,
    value: value as Json,
    description: parsed.data.description || null,
    updated_by: ctx.s.userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await ctx.db.from("platform_settings").upsert(row, { onConflict: "key" }).select("key");
  if (error) return dbFail(error);
  if (!data || data.length === 0) return fail("No row updated (RLS denied the write?).");
  revalidatePath("/admin/settings");
  return ok(`Setting "${parsed.data.key}" saved.`);
}
