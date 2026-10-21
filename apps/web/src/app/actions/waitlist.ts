"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import {
  employerLeadSchema,
  formDataToObject,
  officerLeadSchema,
  type EmployerLeadInput,
  type OfficerLeadInput,
} from "@shiftshield/shared";
import type { ZodError } from "zod";
import { escapeHtml, sendEmail } from "@/lib/email";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import type { FormState, FormValues } from "@/lib/form-state";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MIN_FILL_MS = 3_000;
// Per-IP submission cap. Disabled (0) during the open pilot so no applicant is ever turned away;
// set LEAD_RATE_LIMIT to a positive number to re-enable it.
const RATE_LIMIT = {
  limit: Number(process.env.LEAD_RATE_LIMIT) || 0,
  windowMs: 10 * 60 * 1000,
};

function rateLimited(ipHash: string) {
  if (RATE_LIMIT.limit <= 0) return null;
  const rl = checkRateLimit(`lead:${ipHash}`, RATE_LIMIT);
  return rl.ok ? null : rl;
}

async function requestContext() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  const userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
  const ipHash = createHash("sha256").update(`${serverEnv.ipHashSalt}:${ip}`).digest("hex");
  return { ipHash, userAgent };
}

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const INTERNAL_KEYS = new Set(["kind", "website", "started_at"]);

/** User-visible field values to echo back so a failed submit does not wipe the form. */
function publicValues(raw: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const [k, v] of Object.entries(raw)) {
    if (INTERNAL_KEYS.has(k)) continue;
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.map(String);
  }
  return out;
}

function spamCheck(raw: Record<string, unknown>): string | null {
  if (typeof raw.website === "string" && raw.website.length > 0) return "spam";
  const started = Number(raw.started_at);
  if (Number.isFinite(started) && started > 0 && Date.now() - started < MIN_FILL_MS)
    return "too_fast";
  return null;
}

type LeadInsert = Record<string, string | number | string[] | null>;

async function persistLead(row: LeadInsert): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Open pilot: never turn an applicant away because the database is not wired up yet.
    // The full lead is written to the runtime logs (and emailed when Resend is configured).
    console.warn("[waitlist] Supabase not configured; lead kept in logs only:", JSON.stringify(row));
    return { ok: true };
  }
  const { error } = await supabase.from("waitlist_leads").insert(row);
  if (error) {
    console.error("[waitlist] insert failed", error);
    return { ok: false, reason: "db_error" };
  }
  return { ok: true };
}

function notify(subject: string, lines: Array<[string, string | number | null | undefined]>) {
  if (!serverEnv.resendApiKey || !serverEnv.leadNotifyEmail) return;
  const rows = lines
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#9A9FA6">${escapeHtml(k)}</td><td style="padding:4px 0"><strong>${escapeHtml(String(v))}</strong></td></tr>`,
    )
    .join("");
  const text = lines
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n");
  const adminUrl = `${serverEnv.siteUrl}/admin/leads`;
  after(async () => {
    await sendEmail({
      to: serverEnv.leadNotifyEmail!,
      subject,
      html: `<div style="font-family:Inter,system-ui,sans-serif;color:#07111F"><h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2><table>${rows}</table><p style="margin-top:16px"><a href="${adminUrl}" style="color:#1E63E9">Open the leads dashboard</a></p></div>`,
      text: `${subject}\n\n${text}\n\n${adminUrl}`,
    });
  });
}

const GENERIC_ERROR =
  "Something went wrong on our end. Please try again, or call (254) 276-4393 and we will get you set up.";

export async function submitEmployerLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requestContext();
  const rl = rateLimited(ctx.ipHash);
  if (rl) {
    return {
      status: "error",
      message: `Too many submissions. Try again in ${Math.ceil(rl.retryAfterSec / 60)} min.`,
      values: publicValues(formDataToObject(formData, ["shift_types"])),
    };
  }

  const raw = formDataToObject(formData, ["shift_types"]);
  raw.kind = "employer";
  if (spamCheck(raw)) return { status: "success", message: "Thanks! We'll be in touch." }; // silently drop

  const parsed = employerLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: publicValues(raw),
    };
  }
  const d: EmployerLeadInput = parsed.data;

  const result = await persistLead({
    kind: "employer",
    contact_name: d.contact_name,
    email: d.email,
    phone: d.phone,
    city: d.city,
    notes: d.notes || null,
    company_name: d.company_name,
    title: d.title || null,
    company_type: d.company_type,
    site_count: d.site_count,
    shifts_per_month: d.shifts_per_month,
    shift_types: d.shift_types,
    coverage_timeline: d.coverage_timeline,
    source: "landing_pilot_form",
    user_agent: ctx.userAgent,
    ip_hash: ctx.ipHash,
  });
  if (!result.ok) return { status: "error", message: GENERIC_ERROR, values: publicValues(raw) };

  notify(`New pilot lead: ${d.company_name}`, [
    ["Company", d.company_name],
    ["Contact", `${d.contact_name}${d.title ? `, ${d.title}` : ""}`],
    ["Email", d.email],
    ["Phone", d.phone],
    ["Type", d.company_type],
    ["City", d.city],
    ["Sites", d.site_count],
    ["Shifts / month", d.shifts_per_month],
    ["Shift types", d.shift_types.join(", ")],
    ["Timeline", d.coverage_timeline],
    ["Notes", d.notes || ""],
  ]);

  return {
    status: "success",
    message: `Thanks, ${d.contact_name.split(" ")[0]}! You're on the pilot list. Ashley will reach out within one business day to get ${d.company_name} set up.`,
  };
}

export async function submitOfficerLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requestContext();
  const rl = rateLimited(ctx.ipHash);
  if (rl) {
    return {
      status: "error",
      message: `Too many submissions. Try again in ${Math.ceil(rl.retryAfterSec / 60)} min.`,
      values: publicValues(formDataToObject(formData)),
    };
  }

  const raw = formDataToObject(formData);
  raw.kind = "officer";
  if (spamCheck(raw))
    return { status: "success", message: "Thanks! We'll let you know at launch." };

  const parsed = officerLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: publicValues(raw),
    };
  }
  const d: OfficerLeadInput = parsed.data;

  const result = await persistLead({
    kind: "officer",
    contact_name: d.contact_name,
    email: d.email,
    phone: d.phone,
    city: d.city,
    license_level: d.license_level,
    source: "landing_officer_form",
    user_agent: ctx.userAgent,
    ip_hash: ctx.ipHash,
  });
  if (!result.ok) return { status: "error", message: GENERIC_ERROR, values: publicValues(raw) };

  notify(`New officer signup: ${d.contact_name}`, [
    ["Name", d.contact_name],
    ["Email", d.email],
    ["Phone", d.phone],
    ["City", d.city],
    ["License", d.license_level],
  ]);

  return {
    status: "success",
    message: `You're on the list, ${d.contact_name.split(" ")[0]}. We'll text and email you the moment shifts open in your area.`,
  };
}

export async function waitlistConfigured(): Promise<boolean> {
  return isSupabaseConfigured();
}
