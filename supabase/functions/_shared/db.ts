/**
 * Direct Postgres access for the handful of writes the column-guard triggers protect.
 *
 * `companies` (billing columns) and `officer_profiles` (verification / payout columns) have BEFORE UPDATE
 * triggers that revert privileged columns unless the transaction-local GUC `shiftshield.internal` is on
 * (see 20261021000300_rls.sql). Triggers fire for the service role too, so a plain supabase-js update
 * from an Edge Function would be silently reverted. This helper opens one transaction, sets the GUC,
 * runs the update, and commits.
 *
 * Uses SUPABASE_DB_URL, which the Supabase platform injects into every Edge Function.
 */
import postgres from "postgres";
import type { CompanyRow, OfficerProfileRow } from "@shared/db/types.ts";
import { env } from "./env.ts";

type GuardedTables = {
  companies: CompanyRow;
  officer_profiles: OfficerProfileRow;
};

type Scalar = string | number | boolean | null;

let client: postgres.Sql | null = null;

function dbUrl(): string {
  const url = env("SUPABASE_DB_URL") ?? env("DATABASE_URL");
  if (!url) throw new Error("SUPABASE_DB_URL (or DATABASE_URL) is not set; cannot run internal updates.");
  return url;
}

function needsTls(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return !(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "host.docker.internal" ||
      host.startsWith("supabase_db") ||
      host.endsWith(".local")
    );
  } catch {
    return true;
  }
}

function sql(): postgres.Sql {
  if (client) return client;
  const url = dbUrl();
  client = postgres(url, {
    max: 2,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: needsTls(url) ? "require" : false,
  });
  return client;
}

/**
 * Update guarded columns on one row. Returns the number of rows updated.
 * `patch` values must be scalars (ISO strings for timestamps).
 */
export async function internalUpdate<T extends keyof GuardedTables>(
  table: T,
  where: { column: keyof GuardedTables[T] & string; value: string },
  patch: Partial<Record<keyof GuardedTables[T] & string, Scalar>>,
): Promise<number> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [string, Scalar][];
  if (entries.length === 0) return 0;
  const values: Record<string, Scalar> = Object.fromEntries(entries);
  const tableName: string = table;
  const whereColumn: string = where.column;
  const whereValue: string = where.value;
  const db = sql();
  const rows = await db.begin(async (tx) => {
    await tx`select set_config('shiftshield.internal', 'on', true)`;
    return await tx`
      update public.${tx(tableName)}
      set ${tx(values)}, updated_at = now()
      where ${tx(whereColumn)} = ${whereValue}
      returning 1 as ok
    `;
  });
  return rows.length;
}
