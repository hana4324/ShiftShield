/**
 * Runs the real migrations inside PGlite (Postgres compiled to WASM) so schema, plpgsql and RLS
 * policies are exercised without Docker. Differences from Supabase, all handled here:
 *   - no PostGIS: geo_point becomes a jsonb domain and the geo helpers are replaced by geo-stub.sql
 *   - no pg_cron / pg_net / storage / auth schemas: those migrations (or lines) are marked
 *     `-- pglite:skip-file` / `-- pglite:skip-line` and a tiny auth stub is created instead
 *   - default API grants (anon / authenticated / service_role) are applied explicitly
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, "..", "..", "migrations");
export const SEED_FILE = join(here, "..", "..", "seed.sql");

const PRELUDE = `
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists private;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;
create domain public.geo_point as jsonb;
create table auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text, role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''), '')::uuid;
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon');
$$;
`;

const GRANTS = `
grant usage on schema public, private, auth to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`;

function stripSkippedLines(sql: string): string {
  const lines = sql.split(/\r?\n/);
  const out: string[] = [];
  let skipNext = false;
  for (const line of lines) {
    if (line.trim() === "-- pglite:skip-line") {
      skipNext = true;
      continue;
    }
    if (skipNext) {
      if (line.trim() === "") continue;
      skipNext = false;
      continue; // drop the statement line that follows the marker
    }
    out.push(line);
  }
  return out.join("\n");
}

export interface MigrationFile {
  name: string;
  sql: string;
  skipped: boolean;
  replacement?: string;
}

export function loadMigrations(): MigrationFile[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((name) => {
    const raw = readFileSync(join(MIGRATIONS_DIR, name), "utf8");
    const skipped = raw.includes("-- pglite:skip-file");
    const replacement = name.includes("geo_helpers") ? readFileSync(join(here, "geo-stub.sql"), "utf8") : undefined;
    return { name, sql: stripSkippedLines(raw), skipped, replacement };
  });
}

export async function createTestDb(opts: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(PRELUDE);
  for (const m of loadMigrations()) {
    if (m.replacement) {
      await db.exec(m.replacement);
      continue;
    }
    if (m.skipped) continue;
    try {
      await db.exec(m.sql);
    } catch (err) {
      throw new Error(`Migration ${m.name} failed: ${(err as Error).message}`);
    }
  }
  await db.exec(GRANTS);
  if (opts.seed !== false) {
    await db.exec(readFileSync(SEED_FILE, "utf8"));
  }
  return db;
}

export interface Claims {
  sub: string;
  app_role: "officer" | "employer_owner" | "employer_manager" | "admin";
  company_id?: string | null;
  role?: "authenticated" | "anon";
}

/** Impersonate an API caller: switches the Postgres role and sets the JWT claims GUC. */
export async function actAs(db: PGlite, claims: Claims | null): Promise<void> {
  if (!claims) {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
    return;
  }
  const json = JSON.stringify({ sub: claims.sub, role: claims.role ?? "authenticated", app_role: claims.app_role, company_id: claims.company_id ?? null });
  await db.exec(`reset role;`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [json]);
  await db.exec(`set role ${claims.role ?? "authenticated"};`);
}

export async function asService(db: PGlite): Promise<void> {
  await db.exec(`reset role; select set_config('request.jwt.claims', '', false); set role service_role;`);
}

export async function asSuper(db: PGlite): Promise<void> {
  await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
}

let counter = 0;
export function uuid(prefix = "0"): string {
  counter += 1;
  const n = counter.toString(16).padStart(12, "0");
  return `${prefix.padStart(8, "0")}-0000-4000-8000-${n}`;
}

export interface SeededUser {
  id: string;
  email: string;
}

export async function seedUser(db: PGlite, input: { role: Claims["app_role"]; name: string; email?: string }): Promise<SeededUser> {
  await asSuper(db);
  const id = uuid("1");
  const email = input.email ?? `${id}@test.local`;
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, email, JSON.stringify({ full_name: input.name, role: input.role })]);
  await db.query(`insert into public.profiles (id, role, full_name, email) values ($1, $2, $3, $4)`, [id, input.role, input.name, email]);
  return { id, email };
}

export async function seedOfficer(db: PGlite, input: { name: string; lat: number; lng: number; level?: 2 | 3; radiusMi?: number; eligible?: boolean }): Promise<SeededUser> {
  const u = await seedUser(db, { role: "officer", name: input.name });
  const eligible = input.eligible !== false;
  await db.query(
    `insert into public.officer_profiles (user_id, home_geo, home_city, travel_radius_mi, is_available, is_18_plus, is_21_plus, signup_fee_paid_at, background_status, account_status)
     values ($1, private.make_point($2, $3), 'Dallas, TX', $4, true, true, true, $5, $6, $7)`,
    [u.id, input.lat, input.lng, input.radiusMi ?? 25, eligible ? new Date().toISOString() : null, eligible ? "clear" : "not_started", eligible ? "active" : "onboarding"],
  );
  if (eligible) {
    await db.query(
      `insert into public.officer_licenses (officer_id, license_type_id, license_number, expires_on, front_path, back_path, status)
       values ($1, (select id from public.license_types where code = $2), 'TX-TEST', current_date + 200, $3, $4, 'approved')`,
      [u.id, input.level === 3 ? "TX_L3" : "TX_L2", `${u.id}/f.jpg`, `${u.id}/b.jpg`],
    );
  }
  return u;
}

export async function seedCompany(db: PGlite, input: { name: string; plan?: "essential" | "pro" | "enterprise"; owner?: SeededUser }): Promise<{ id: string; owner: SeededUser; siteId: string }> {
  const owner = input.owner ?? (await seedUser(db, { role: "employer_owner", name: `${input.name} Owner` }));
  await asSuper(db);
  const id = uuid("c");
  await db.query(
    `insert into public.companies (id, name, type, plan_id, subscription_status, created_by) values ($1, $2, 'security_company', (select id from public.plans where code = $3), 'active', $4)`,
    [id, input.name, input.plan ?? "pro", owner.id],
  );
  await db.query(`insert into public.company_members (company_id, user_id, role) values ($1, $2, 'owner')`, [id, owner.id]);
  const siteId = uuid("5");
  await db.query(
    `insert into public.sites (id, company_id, name, site_type, address, geo, geofence_radius_m) values ($1, $2, $3, 'hospital', '1 Main St, Dallas, TX', private.make_point(32.789, -96.78), 150)`,
    [siteId, id, `${input.name} HQ`],
  );
  return { id, owner, siteId };
}

export async function seedShift(db: PGlite, input: { companyId: string; siteId: string; createdBy: string; startInHours?: number; hours?: number; rateCents?: number; needed?: number; level?: number; fillMode?: "auto" | "review"; status?: "draft" | "open" }): Promise<string> {
  await asSuper(db);
  const id = uuid("a");
  const start = new Date(Date.now() + (input.startInHours ?? 30) * 3600_000);
  const end = new Date(start.getTime() + (input.hours ?? 8) * 3600_000);
  await db.query(
    `insert into public.shifts (id, company_id, site_id, title, start_at, end_at, hourly_rate_cents, officers_needed, required_license_level, fill_mode, status, created_by, published_at)
     values ($1, $2, $3, 'Test Shift', $4, $5, $6, $7, $8, $9, $10, $11, case when $12::boolean then now() else null end)`,
    [id, input.companyId, input.siteId, start.toISOString(), end.toISOString(), input.rateCents ?? 3000, input.needed ?? 1, input.level ?? 2, input.fillMode ?? "auto", input.status ?? "open", input.createdBy, (input.status ?? "open") === "open"],
  );
  return id;
}

export async function rows<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.query<T>(sql, params);
  return r.rows;
}

export async function one<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  const r = await rows<T>(db, sql, params);
  if (r.length === 0) throw new Error(`no rows for: ${sql}`);
  return r[0]!;
}

/** Runs a statement and returns the Postgres error message (or null if it succeeded). */
export async function errorOf(db: PGlite, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}
