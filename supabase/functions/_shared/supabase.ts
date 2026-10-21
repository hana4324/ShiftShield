import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { AppRole, Database as SharedDatabase } from "@shared/db/types.ts";
import { env, requireEnv } from "./env.ts";
import { forbidden, unauthorized } from "./errors.ts";

/**
 * supabase-js requires table rows to satisfy `Record<string, unknown>`. The shared package declares
 * rows as `interface`s, which TypeScript does not give an implicit index signature, so the generic
 * would collapse every row to `never`. Re-mapping each row through a mapped type produces a plain
 * object type with identical members that does satisfy the constraint.
 */
type Plain<T> = { [K in keyof T]: T[K] };
type SharedTables = SharedDatabase["public"]["Tables"];
type SharedViews = SharedDatabase["public"]["Views"];
type AdaptedTables = {
  [K in keyof SharedTables]: {
    Row: Plain<SharedTables[K]["Row"]>;
    Insert: Partial<Plain<SharedTables[K]["Row"]>>;
    Update: Partial<Plain<SharedTables[K]["Row"]>>;
    Relationships: [];
  };
};
type AdaptedViews = {
  [K in keyof SharedViews]: { Row: Plain<SharedViews[K]["Row"]>; Relationships: [] };
};
export type Database = {
  public: {
    Tables: AdaptedTables;
    Views: AdaptedViews;
    Functions: SharedDatabase["public"]["Functions"];
    Enums: SharedDatabase["public"]["Enums"];
    CompositeTypes: Record<string, never>;
  };
};

export type Db = SupabaseClient<Database>;

const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** Service-role client: bypasses RLS. Only for server-side side effects, never returned to callers. */
export function serviceClient(): Db {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), CLIENT_OPTIONS);
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/** Anon-key client that forwards the caller's JWT, so RLS and auth.uid() apply. */
export function userClient(req: Request): Db {
  const token = bearerToken(req);
  if (!token) throw unauthorized();
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    ...CLIENT_OPTIONS,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export interface Claims {
  sub: string;
  app_role: AppRole;
  company_id: string | null;
  officer_status: string | null;
  email: string | null;
}

export interface AuthContext {
  user: User;
  claims: Claims;
  /** RLS-scoped client acting as the caller. */
  client: Db;
  token: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) throw unauthorized("Malformed token.");
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  try {
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof parsed !== "object" || parsed === null) throw new Error("bad payload");
    return parsed as Record<string, unknown>;
  } catch {
    throw unauthorized("Malformed token.");
  }
}

const APP_ROLES: readonly AppRole[] = ["officer", "employer_owner", "employer_manager", "admin"];

function asAppRole(value: unknown): AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value) ? (value as AppRole) : "officer";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Verify the caller with Supabase Auth (getUser validates the token server-side), then read the
 * custom claims (app_role, company_id, officer_status) from the verified token's payload.
 */
export async function requireUser(req: Request): Promise<AuthContext> {
  const token = bearerToken(req);
  if (!token) throw unauthorized();
  const client = userClient(req);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw unauthorized();
  const payload = decodeJwtPayload(token);
  const claims: Claims = {
    sub: data.user.id,
    app_role: asAppRole(payload["app_role"]),
    company_id: asNullableString(payload["company_id"]),
    officer_status: asNullableString(payload["officer_status"]),
    email: data.user.email ?? asNullableString(payload["email"]),
  };
  return { user: data.user, claims, client, token };
}

export function requireRole(ctx: AuthContext, ...roles: readonly AppRole[]): void {
  if (!roles.includes(ctx.claims.app_role)) throw forbidden();
}

export function requireCompany(ctx: AuthContext): string {
  if (!ctx.claims.company_id) throw forbidden("Create or join a company first.");
  return ctx.claims.company_id;
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/** True when the bearer token is the service-role key (pg_cron / internal callers). */
export function isServiceRequest(req: Request): boolean {
  const token = bearerToken(req);
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return !!token && !!key && constantTimeEqual(token, key);
}

export function requireServiceRequest(req: Request): void {
  if (!isServiceRequest(req)) throw forbidden("This endpoint is for internal jobs only.");
}
