"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

/**
 * Browser client (anon key, cookie session shared with the server helpers).
 * The admin panel does all data access in Server Components / Server Actions; this exists for
 * client-side features that need Realtime or Storage uploads later. Never pass a service key here.
 */
let cached: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (cached) return cached;
  cached = createBrowserClient<Database>(url, anonKey, {
    cookieOptions: { name: "ss-auth", path: "/", sameSite: "lax" },
  });
  return cached;
}
