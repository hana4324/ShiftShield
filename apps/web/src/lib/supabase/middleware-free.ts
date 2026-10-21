import "server-only";
import { combineChunks, stringFromBase64URL } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_AUTH_COOKIE } from "./server";

/**
 * Session handling WITHOUT a proxy/middleware.
 *
 * @supabase/ssr normally relies on a middleware to refresh tokens and write the new cookies on
 * every request. This app has none, and Server Components cannot set cookies, so:
 *
 *  1. Server Components read the stored session straight from the cookie (no network, no refresh).
 *     If the access token is still valid they verify it with `auth.getUser()`; if it is expired
 *     they render `<SessionRefresh>` instead of touching Supabase (a refresh whose new refresh
 *     token cannot be persisted would burn the one in the cookie).
 *  2. `<SessionRefresh>` (client) calls the `refreshAdminSession` Server Action, which CAN write
 *     cookies, then re-renders the route. It also schedules a refresh shortly before expiry while
 *     the tab is open, so the expired path is rare.
 *  3. Route Handlers and Server Actions use a "readwrite" client, so refreshes there persist.
 */

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number | null;
}

/** Read the Supabase session cookie (chunked + base64url, as written by @supabase/ssr). */
export async function readStoredSession(): Promise<StoredSession | null> {
  const store = await cookies();
  const raw = await combineChunks(SUPABASE_AUTH_COOKIE, (name) => store.get(name)?.value);
  if (!raw) return null;
  try {
    const json = raw.startsWith("base64-") ? stringFromBase64URL(raw.slice("base64-".length)) : raw;
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    const s = parsed as Record<string, unknown>;
    if (typeof s.access_token !== "string" || typeof s.refresh_token !== "string") return null;
    const exp =
      typeof s.expires_at === "number"
        ? s.expires_at
        : (decodeJwtPayload(s.access_token)?.exp as number | undefined) ?? null;
    return {
      accessToken: s.access_token,
      refreshToken: s.refresh_token,
      expiresAt: typeof exp === "number" ? exp : null,
    };
  } catch {
    return null;
  }
}

/** Decode (without verifying) a JWT payload. Only use after `auth.getUser()` has verified the token. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** True when the access token expires within `skewSec` seconds (or already has). */
export function isExpiring(session: StoredSession, nowMs: number, skewSec = 60): boolean {
  if (session.expiresAt === null) return false;
  return session.expiresAt * 1000 - nowMs < skewSec * 1000;
}
