import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, serverEnv } from "./env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. SERVER ONLY. Bypasses RLS, so every caller must do its own
 * authorization (the waitlist server action is public by design; admin reads check the admin session).
 * Returns null when Supabase is not configured so the site still runs locally.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cached) return cached;
  cached = createClient(serverEnv.supabaseUrl!, serverEnv.supabaseServiceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "shiftshield-web" } },
  });
  return cached;
}
