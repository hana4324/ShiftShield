import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseAuthConfigured, serverEnv } from "@/lib/env";
import type { Database } from "./database";

/** Typed client bound to the signed-in admin's session (RLS + audit log see the admin, not a service key). */
export type DbClient = SupabaseClient<Database>;

/** Cookie that holds the Supabase session. Fixed name so `middleware-free.ts` can read it without the client. */
export const SUPABASE_AUTH_COOKIE = "ss-auth";

/**
 * Server Components cannot write cookies (HTTP streaming has started), so a client created
 * there must never try to persist a refreshed session: pass `"readonly"`. Server Actions and
 * Route Handlers can set cookies and use `"readwrite"`, which is where token refreshes land.
 */
export type CookieMode = "readonly" | "readwrite";

/**
 * Supabase client for server code, authenticated by the request cookies.
 * Returns null when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing so
 * the site keeps building and running without configuration.
 *
 * Must only be called inside a `<Suspense>` boundary, a Server Action or a Route Handler
 * (it reads `cookies()`).
 */
export async function createSupabaseServerClient(
  mode: CookieMode = "readonly",
): Promise<DbClient | null> {
  if (!isSupabaseAuthConfigured()) return null;
  const store = await cookies();
  return createServerClient<Database>(serverEnv.supabaseUrl!, serverEnv.supabaseAnonKey!, {
    cookieOptions: {
      name: SUPABASE_AUTH_COOKIE,
      path: "/",
      sameSite: "lax",
      secure: serverEnv.isProduction,
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        if (mode === "readonly") return;
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Cookie writes are only possible in Server Actions / Route Handlers; ignore elsewhere.
        }
      },
    },
  });
}
