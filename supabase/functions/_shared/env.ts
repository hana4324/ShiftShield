/** Small env helpers. Never log or return the values these read. */

export function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function envInt(name: string, fallback: number): number {
  const raw = env(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Public web app origin used for links in emails (invites, billing). */
export function appUrl(): string {
  return (env("APP_URL") ?? "https://shiftshield.example").replace(/\/+$/, "");
}
