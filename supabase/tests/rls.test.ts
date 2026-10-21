import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, asSuper, createTestDb, errorOf, rows, seedCompany, seedOfficer, seedShift, type SeededUser } from "./pglite/harness";

let db: PGlite;
let companyA: Awaited<ReturnType<typeof seedCompany>>;
let companyB: Awaited<ReturnType<typeof seedCompany>>;
let officer1: SeededUser;
let officer2: SeededUser;
let admin: { id: string };
let shiftA: string;
let draftA: string;
let shiftB: string;

beforeAll(async () => {
  db = await createTestDb();
  companyA = await seedCompany(db, { name: "Alpha Security" });
  companyB = await seedCompany(db, { name: "Bravo Security" });
  officer1 = await seedOfficer(db, { name: "Officer One", lat: 32.8, lng: -96.8 });
  officer2 = await seedOfficer(db, { name: "Officer Two", lat: 32.81, lng: -96.81 });
  await asSuper(db);
  const a = await rows<{ id: string }>(db, "insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000adaa', 'admin@test.local') returning id");
  admin = { id: a[0]!.id };
  await db.query("insert into public.profiles (id, role, full_name) values ($1, 'admin', 'Admin')", [admin.id]);
  shiftA = await seedShift(db, { companyId: companyA.id, siteId: companyA.siteId, createdBy: companyA.owner.id });
  draftA = await seedShift(db, { companyId: companyA.id, siteId: companyA.siteId, createdBy: companyA.owner.id, status: "draft" });
  shiftB = await seedShift(db, { companyId: companyB.id, siteId: companyB.siteId, createdBy: companyB.owner.id });
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const employerA = () => actAs(db, { sub: companyA.owner.id, app_role: "employer_owner", company_id: companyA.id });
const employerB = () => actAs(db, { sub: companyB.owner.id, app_role: "employer_owner", company_id: companyB.id });
const asOfficer1 = () => actAs(db, { sub: officer1.id, app_role: "officer" });
const asOfficer2 = () => actAs(db, { sub: officer2.id, app_role: "officer" });
const asAdmin = () => actAs(db, { sub: admin.id, app_role: "admin" });

describe("shifts", () => {
  it("an employer cannot read another company's shifts", async () => {
    await employerA();
    const mine = await rows<{ id: string }>(db, "select id from public.shifts");
    expect(mine.map((r) => r.id).sort()).toEqual([shiftA, draftA].sort());
    await employerB();
    const theirs = await rows<{ id: string }>(db, "select id from public.shifts");
    expect(theirs.map((r) => r.id)).toEqual([shiftB]);
  });

  it("an employer cannot update another company's shift", async () => {
    await employerB();
    const updated = await rows(db, "update public.shifts set title = 'hacked' where id = $1 returning id", [shiftA]);
    expect(updated).toHaveLength(0);
  });

  it("officers see open shifts from any company but never drafts", async () => {
    await asOfficer1();
    const seen = await rows<{ id: string }>(db, "select id from public.shifts order by id");
    expect(seen.map((r) => r.id).sort()).toEqual([shiftA, shiftB].sort());
  });

  it("officers cannot insert or update shifts", async () => {
    await asOfficer1();
    const err = await errorOf(db, "insert into public.shifts (company_id, site_id, title, start_at, end_at, hourly_rate_cents) values ($1, $2, 'x', now() + interval '2 day', now() + interval '2 day 8 hours', 2000)", [companyA.id, companyA.siteId]);
    expect(err).toMatch(/row-level security/);
  });

  it("employers cannot flip status directly (must use publish_shift)", async () => {
    await employerA();
    const err = await errorOf(db, "update public.shifts set status = 'open' where id = $1", [draftA]);
    expect(err).toMatch(/publish_shift/);
  });

  it("admins see everything", async () => {
    await asAdmin();
    const all = await rows<{ id: string }>(db, "select id from public.shifts");
    expect(all).toHaveLength(3);
  });
});

describe("officer private data", () => {
  it("an officer cannot read another officer's license rows", async () => {
    await asOfficer1();
    const mine = await rows<{ officer_id: string }>(db, "select officer_id from public.officer_licenses");
    expect(mine.every((r) => r.officer_id === officer1.id)).toBe(true);
    expect(mine).toHaveLength(1);
  });

  it("an employer cannot read officer_licenses at all (license images are owner + admin only)", async () => {
    await employerA();
    const seen = await rows(db, "select id from public.officer_licenses");
    expect(seen).toHaveLength(0);
  });

  it("an employer cannot read officer_profiles of officers who never applied", async () => {
    await employerA();
    const seen = await rows(db, "select user_id from public.officer_profiles");
    expect(seen).toHaveLength(0);
  });

  it("an officer cannot grant themselves verification", async () => {
    await asOfficer2();
    await db.query("update public.officer_profiles set background_status = 'clear', signup_fee_paid_at = now(), account_status = 'active', rating_avg = 5 where user_id = $1", [officer2.id]);
    await asSuper(db);
    const row = await rows<{ rating_avg: string }>(db, "select rating_avg from public.officer_profiles where user_id = $1", [officer2.id]);
    expect(Number(row[0]!.rating_avg)).toBe(0);
  });

  it("an officer can update their own availability and travel radius", async () => {
    await asOfficer1();
    await db.query("update public.officer_profiles set is_available = false, travel_radius_mi = 40 where user_id = $1", [officer1.id]);
    const row = await rows<{ is_available: boolean; travel_radius_mi: number }>(db, "select is_available, travel_radius_mi from public.officer_profiles where user_id = $1", [officer1.id]);
    expect(row[0]).toEqual({ is_available: false, travel_radius_mi: 40 });
    await db.query("update public.officer_profiles set is_available = true where user_id = $1", [officer1.id]);
  });
});

describe("company data", () => {
  it("companies and sites are scoped to the member's company", async () => {
    await employerA();
    const companies = await rows<{ id: string }>(db, "select id from public.companies");
    expect(companies.map((c) => c.id)).toEqual([companyA.id]);
    const sites = await rows<{ company_id: string }>(db, "select company_id from public.sites");
    expect(sites.every((s) => s.company_id === companyA.id)).toBe(true);
  });

  it("an owner cannot change billing fields (Stripe webhooks own them)", async () => {
    await employerA();
    await db.query("update public.companies set is_pilot = true, subscription_status = 'active', plan_id = (select id from public.plans where code = 'enterprise') where id = $1", [companyA.id]);
    await asSuper(db);
    const c = await rows<{ is_pilot: boolean; code: string }>(db, "select c.is_pilot, p.code from public.companies c join public.plans p on p.id = c.plan_id where c.id = $1", [companyA.id]);
    expect(c[0]).toEqual({ is_pilot: false, code: "pro" });
  });
});

describe("applications, assignments and live location", () => {
  it("employer sees an officer's public profile only after they apply, and never the license image paths", async () => {
    await asSuper(db);
    await db.query("update public.shifts set fill_mode = 'review' where id = $1", [shiftA]);
    await asOfficer1();
    const res = await rows<{ accept_shift: { outcome: string } }>(db, "select public.accept_shift($1) as accept_shift", [shiftA]);
    expect(res[0]!.accept_shift.outcome).toBe("applied");

    await employerA();
    const apps = await rows<{ officer_id: string }>(db, "select officer_id from public.shift_applications");
    expect(apps.map((a) => a.officer_id)).toEqual([officer1.id]);
    const card = await rows<{ user_id: string; license_level: number; full_name: string }>(db, "select user_id, license_level, full_name from public.officer_public_profiles");
    expect(card.map((c) => c.user_id)).toEqual([officer1.id]);
    expect(card[0]!.license_level).toBe(2);
    const licenses = await rows(db, "select id from public.officer_licenses");
    expect(licenses).toHaveLength(0);

    await employerB();
    const none = await rows(db, "select user_id from public.officer_public_profiles");
    expect(none).toHaveLength(0);
  });

  it("employer only sees location pings while the officer is clocked in at its site", async () => {
    await employerA();
    const app = await rows<{ id: string }>(db, "select id from public.shift_applications where shift_id = $1", [shiftA]);
    await db.query("select public.confirm_applicant($1)", [app[0]!.id]);
    await asSuper(db);
    await db.query("update public.shifts set start_at = now() - interval '5 minutes', end_at = now() + interval '8 hours' where id = $1", [shiftA]);
    const asg = await rows<{ id: string }>(db, "select id from public.assignments where shift_id = $1", [shiftA]);
    const assignmentId = asg[0]!.id;

    await employerA();
    expect(await rows(db, "select id from public.location_pings")).toHaveLength(0);

    await asOfficer1();
    const clockIn = await rows<{ r: { ok: boolean } }>(db, "select public.clock_in($1, 32.789, -96.78, 5) as r", [assignmentId]);
    expect(clockIn[0]!.r.ok).toBe(true);
    await db.query("select public.record_location_ping($1, 32.7892, -96.7801, 8)", [assignmentId]);

    await employerA();
    expect(await rows(db, "select id from public.location_pings")).toHaveLength(2);
    await employerB();
    expect(await rows(db, "select id from public.location_pings")).toHaveLength(0);

    await asOfficer1();
    await db.query("select public.clock_out($1, 32.789, -96.78, 5, 'all quiet')", [assignmentId]);
    await employerA();
    expect(await rows(db, "select id from public.location_pings")).toHaveLength(0);
  });
});

describe("messaging", () => {
  it("only booked officers and the company can read a shift thread", async () => {
    await asSuper(db);
    const thread = await rows<{ id: string }>(db, "insert into public.message_threads (shift_id, company_id) values ($1, $2) on conflict (shift_id) do update set company_id = excluded.company_id returning id", [shiftA, companyA.id]);
    const threadId = thread[0]!.id;
    await employerA();
    await db.query("insert into public.messages (thread_id, sender_id, body) values ($1, $2, 'Park in garage C')", [threadId, companyA.owner.id]);
    await asOfficer1();
    expect(await rows(db, "select id from public.messages where thread_id = $1", [threadId])).toHaveLength(1);
    await asOfficer2();
    expect(await rows(db, "select id from public.messages where thread_id = $1", [threadId])).toHaveLength(0);
    const err = await errorOf(db, "insert into public.messages (thread_id, sender_id, body) values ($1, $2, 'hi')", [threadId, officer2.id]);
    expect(err).toMatch(/row-level security/);
  });
});
