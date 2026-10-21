"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { waitlistStatusSchema } from "@shiftshield/shared";
import {
  clearAdminSessionCookie,
  requireAdmin,
  resolveIsAdmin,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { adminAuthMode, isAdminConfigured, serverEnv } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NOT_ADMIN = "This account is not an admin.";

function safeNext(raw: FormDataEntryValue | null): string {
  const next = String(raw ?? "/admin");
  return next.startsWith("/admin") ? next : "/admin";
}

async function loginRateLimited(): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = createHash("sha256").update(`${serverEnv.ipHashSalt}:admin:${ip}`).digest("hex");
  return !checkRateLimit(`admin-login:${key}`, { limit: 8, windowMs: 15 * 60 * 1000 }).ok;
}

export async function loginAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isAdminConfigured()) {
    return {
      status: "error",
      message:
        adminAuthMode() === "supabase"
          ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set on the server."
          : "ADMIN_PASSWORD is not set on the server.",
    };
  }
  if (await loginRateLimited()) {
    return { status: "error", message: "Too many attempts. Try again later." };
  }
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (adminAuthMode() === "password") {
    if (!verifyAdminPassword(password)) return { status: "error", message: "Incorrect password." };
    await setAdminSessionCookie();
    redirect(next);
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email || !password) {
    return { status: "error", message: "Enter your email and password.", values: { email } };
  }
  const supabase = await createSupabaseServerClient("readwrite");
  if (!supabase) return { status: "error", message: "Supabase is not configured." };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return { status: "error", message: "Incorrect email or password.", values: { email } };
  }
  // signInWithPassword already verified the credentials with the Auth server; confirm the user
  // record once more and then check the admin claim (JWT first, profiles.role as the fallback).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await resolveIsAdmin(supabase, user.id, data.session.access_token))) {
    await supabase.auth.signOut();
    return { status: "error", message: NOT_ADMIN, values: { email } };
  }
  redirect(next);
}

export async function logoutAdmin(): Promise<void> {
  if (adminAuthMode() === "supabase") {
    const supabase = await createSupabaseServerClient("readwrite");
    if (supabase) {
      // Global sign-out revokes the refresh token server-side; fall back to clearing the cookie.
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) await supabase.auth.signOut({ scope: "local" });
    }
  }
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

/**
 * Refresh the Supabase session from a Server Action (the only place cookies can be written
 * without a middleware). Called by <SessionRefresh> when the access token is expired or about to.
 */
export async function refreshAdminSession(): Promise<{ ok: boolean }> {
  if (adminAuthMode() !== "supabase") return { ok: true };
  const supabase = await createSupabaseServerClient("readwrite");
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) {
    await supabase.auth.signOut({ scope: "local" });
    return { ok: false };
  }
  return { ok: true };
}

export async function updateLeadStatus(formData: FormData): Promise<void> {
  await requireAdmin({ mode: "readwrite" });
  const id = String(formData.get("id") ?? "");
  const status = waitlistStatusSchema.safeParse(formData.get("status"));
  const adminNotes = formData.get("admin_notes");
  if (!id || !status.success) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const patch: Record<string, string | null> = { status: status.data };
  if (typeof adminNotes === "string") patch.admin_notes = adminNotes.trim() || null;
  if (status.data === "contacted" || status.data === "pilot")
    patch.contacted_at = new Date().toISOString();
  const { error } = await supabase.from("waitlist_leads").update(patch).eq("id", id);
  if (error) console.error("[admin] update lead failed", error);
  revalidatePath("/admin/leads");
}
