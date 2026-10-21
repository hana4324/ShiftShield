import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminAuthMode, serverEnv } from "./env";
import { decodeJwtPayload, isExpiring, readStoredSession } from "./supabase/middleware-free";
import { createSupabaseServerClient, type CookieMode, type DbClient } from "./supabase/server";

/**
 * Admin authentication. Single entry point for every protected surface: `requireAdmin()`.
 *
 *  - When NEXT_PUBLIC_SUPABASE_URL is set: Supabase Auth (email + password) and the JWT claim
 *    `app_role = 'admin'` written by the custom access token hook. Data access then goes through
 *    the admin's own session client so RLS and `private.audit()` record who did what.
 *  - Otherwise (local demo without a backend): the Phase 0 shared ADMIN_PASSWORD cookie gate.
 *    No database is available in that mode, so pages show a "not configured" panel.
 */

export type AdminSession =
  | {
      kind: "supabase";
      userId: string;
      email: string | null;
      accessToken: string;
      /** Unix seconds when the access token expires (drives the keepalive refresh). */
      expiresAt: number | null;
      db: DbClient;
    }
  | { kind: "password"; db: null };

export type AdminSessionState =
  | { status: "ok"; session: AdminSession }
  /** Access token expired; only a Server Action / Route Handler can refresh and persist it. */
  | { status: "expired" }
  /** Signed in to Supabase, but the account is not an admin. */
  | { status: "forbidden"; email: string | null }
  | { status: "none" };

export class AdminAuthError extends Error {
  constructor(public readonly state: Exclude<AdminSessionState, { status: "ok" }>) {
    super(`admin auth: ${state.status}`);
  }
}

// ---------- Phase 0 password gate (fallback only) ----------

export const ADMIN_COOKIE = "ss_admin";
const SESSION_HOURS = 12;

function secret(): string | null {
  return serverEnv.adminSessionSecret ?? serverEnv.adminPassword ?? null;
}

function sign(payload: string): string {
  return createHmac("sha256", secret() ?? "")
    .update(payload)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = serverEnv.adminPassword;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

export function createSessionToken(now = Date.now()): string {
  const exp = String(now + SESSION_HOURS * 3600 * 1000);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token || !secret()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (!/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(sig, sign(exp));
}

export async function setAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set({
    name: ADMIN_COOKIE,
    value: createSessionToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv.isProduction,
    path: "/admin",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set({ name: ADMIN_COOKIE, value: "", path: "/admin", maxAge: 0 });
}

// ---------- Supabase Auth ----------

/** Is this verified user an admin? JWT claim first, `profiles.role` as the fallback. */
export async function resolveIsAdmin(db: DbClient, userId: string, accessToken: string) {
  const claims = decodeJwtPayload(accessToken);
  if (claims?.app_role === "admin") return true;
  const { data } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

async function supabaseSessionState(mode: CookieMode): Promise<AdminSessionState> {
  const stored = await readStoredSession();
  if (!stored) return { status: "none" };
  // Date.now() is safe here: cookies() above already made this render request-time.
  if (mode === "readonly" && isExpiring(stored, Date.now(), 30)) return { status: "expired" };

  const db = await createSupabaseServerClient(mode);
  if (!db) return { status: "none" };
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return { status: "none" };

  // The token may have been refreshed by getUser() in readwrite mode; read the current one.
  const {
    data: { session },
  } = await db.auth.getSession();
  const accessToken = session?.access_token ?? stored.accessToken;

  if (!(await resolveIsAdmin(db, user.id, accessToken))) {
    return { status: "forbidden", email: user.email ?? null };
  }
  return {
    status: "ok",
    session: {
      kind: "supabase",
      userId: user.id,
      email: user.email ?? null,
      accessToken,
      expiresAt: session?.expires_at ?? stored.expiresAt,
      db,
    },
  };
}

async function passwordSessionState(): Promise<AdminSessionState> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value)
    ? { status: "ok", session: { kind: "password", db: null } }
    : { status: "none" };
}

/**
 * Resolve the admin session for this request. Reads cookies, so call it only inside a
 * `<Suspense>` boundary, a Server Action or a Route Handler. Memoized per request.
 */
export const getAdminSession = cache(
  async (mode: CookieMode = "readonly"): Promise<AdminSessionState> =>
    adminAuthMode() === "supabase" ? supabaseSessionState(mode) : passwordSessionState(),
);

export async function isAdminSession(): Promise<boolean> {
  return (await getAdminSession()).status === "ok";
}

/**
 * The one gate every protected layout, page, Server Action and Route Handler goes through.
 * Redirects to /admin/login by default; `onFail: "throw"` raises `AdminAuthError` instead
 * (for Route Handlers that want to answer 401).
 */
export async function requireAdmin(opts: {
  mode?: CookieMode;
  onFail?: "redirect" | "throw";
} = {}): Promise<AdminSession> {
  const state = await getAdminSession(opts.mode ?? "readonly");
  if (state.status === "ok") return state.session;
  if (opts.onFail === "throw") throw new AdminAuthError(state);
  redirect("/admin/login");
}
