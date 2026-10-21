import "server-only";

/**
 * Server-side environment access. Everything here is optional so the marketing site
 * builds and runs with zero configuration; features degrade gracefully and log a warning.
 */
function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export const serverEnv = {
  siteUrl: optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
  supabaseUrl: optional("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: optional("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
  googleMapsWebKey: optional("NEXT_PUBLIC_GOOGLE_MAPS_WEB_KEY"),
  adminPassword: optional("ADMIN_PASSWORD"),
  adminSessionSecret: optional("ADMIN_SESSION_SECRET"),
  ipHashSalt: optional("IP_HASH_SALT") ?? "shiftshield-dev-salt",
  resendApiKey: optional("RESEND_API_KEY"),
  resendFromEmail: optional("RESEND_FROM_EMAIL") ?? "ShiftShield <onboarding@resend.dev>",
  leadNotifyEmail: optional("LEAD_NOTIFY_EMAIL"),
  isProduction: process.env.NODE_ENV === "production",
} as const;

/** Service-role access (waitlist inserts, lead reads, signed storage URLs). */
export function isSupabaseConfigured(): boolean {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabaseServiceRoleKey);
}

/**
 * Supabase Auth for the admin panel (anon key + cookie sessions via @supabase/ssr).
 * When NEXT_PUBLIC_SUPABASE_URL is set the panel uses Supabase Auth only; the shared
 * ADMIN_PASSWORD gate is a local-demo fallback used solely when the URL is absent.
 */
export function isSupabaseAuthConfigured(): boolean {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabaseAnonKey);
}

/** Which sign-in mechanism the admin panel runs with. */
export type AdminAuthMode = "supabase" | "password";

export function adminAuthMode(): AdminAuthMode {
  return serverEnv.supabaseUrl ? "supabase" : "password";
}

export function isAdminConfigured(): boolean {
  return adminAuthMode() === "supabase" ? isSupabaseAuthConfigured() : Boolean(serverEnv.adminPassword);
}
