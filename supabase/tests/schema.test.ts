import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, loadMigrations, one, rows } from "./pglite/harness";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("migrations", () => {
  it("apply in order and seed reference data", async () => {
    const names = loadMigrations().map((m) => m.name);
    expect(names.length).toBeGreaterThanOrEqual(10);
    const plans = await rows<{ code: string; fee_bps: number }>(db, "select code, fee_bps from public.plans order by price_cents");
    expect(plans.map((p) => p.code)).toEqual(["essential", "pro", "enterprise"]);
    expect(plans.map((p) => p.fee_bps)).toEqual([1000, 1000, 800]);
    const lt = await rows<{ code: string; level: number }>(db, "select code, level from public.license_types order by level");
    expect(lt.map((l) => l.code)).toEqual(["TX_L2", "TX_L3", "TX_L4"]);
    const fee = await one<{ v: number }>(db, "select private.setting_int('signup_fee_cents', 0) as v");
    expect(fee.v).toBe(3000);
  });

  it("enables RLS on every public table", async () => {
    const tables = await rows<{ relname: string; relrowsecurity: boolean }>(
      db,
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    );
    expect(tables.length).toBeGreaterThan(25);
    const unprotected = tables.filter((t) => !t.relrowsecurity).map((t) => t.relname);
    expect(unprotected).toEqual([]);
  });

  it("has created_at and updated_at on every mutable table", async () => {
    const missing = await rows<{ relname: string }>(
      db,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'created_at')
       order by 1`,
    );
    expect(missing).toEqual([]);
  });

  it("computes shift cost like packages/shared (officer pay + fee on top)", async () => {
    const r = await one<{ pay: number; fee: number }>(db, "select private.officer_pay_cents(2600, 480) as pay, private.fee_cents(20800, 1000) as fee");
    expect(r.pay).toBe(20800);
    expect(r.fee).toBe(2080);
    const partial = await one<{ pay: number }>(db, "select private.officer_pay_cents(2600, 200) as pay");
    expect(partial.pay).toBe(8667);
  });

  it("geo helpers measure distance (stubbed haversine in tests, PostGIS in production)", async () => {
    const r = await one<{ d: number; within: boolean }>(
      db,
      "select private.distance_m(private.make_point(32.789, -96.78), private.make_point(32.80, -96.80)) as d, private.within_m(private.make_point(32.789, -96.78), private.make_point(32.7891, -96.7801), 150) as within",
    );
    expect(r.d).toBeGreaterThan(2000);
    expect(r.d).toBeLessThan(2500);
    expect(r.within).toBe(true);
  });
});
