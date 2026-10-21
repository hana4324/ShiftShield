import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, asService, asSuper, createTestDb, errorOf, one, rows, seedCompany, seedOfficer, seedShift, type SeededUser } from "./pglite/harness";

let db: PGlite;
let company: Awaited<ReturnType<typeof seedCompany>>;
let essential: Awaited<ReturnType<typeof seedCompany>>;
let o1: SeededUser;
let o2: SeededUser;
let o3: SeededUser;
let farAway: SeededUser;
let notVerified: SeededUser;

beforeAll(async () => {
  db = await createTestDb();
  company = await seedCompany(db, { name: "Lone Star", plan: "pro" });
  essential = await seedCompany(db, { name: "Small Co", plan: "essential" });
  o1 = await seedOfficer(db, { name: "One", lat: 32.8, lng: -96.8, level: 3 });
  o2 = await seedOfficer(db, { name: "Two", lat: 32.81, lng: -96.79 });
  o3 = await seedOfficer(db, { name: "Three", lat: 32.79, lng: -96.81 });
  farAway = await seedOfficer(db, { name: "Far", lat: 29.76, lng: -95.37 }); // Houston
  notVerified = await seedOfficer(db, { name: "Pending", lat: 32.8, lng: -96.8, eligible: false });
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const employer = () => actAs(db, { sub: company.owner.id, app_role: "employer_owner", company_id: company.id });
const essentialOwner = () => actAs(db, { sub: essential.owner.id, app_role: "employer_owner", company_id: essential.id });
const officer = (u: SeededUser) => actAs(db, { sub: u.id, app_role: "officer" });

describe("publishing and tier enforcement", () => {
  it("publish_shift enforces lead time for the plan", async () => {
    const soon = await seedShift(db, { companyId: essential.id, siteId: essential.siteId, createdBy: essential.owner.id, status: "draft", startInHours: 5 });
    await essentialOwner();
    const err = await errorOf(db, "select public.publish_shift($1)", [soon]);
    expect(err).toMatch(/plan_lead_time/);
    await asSuper(db);
    await db.query("update public.shifts set start_at = now() + interval '30 hours', end_at = now() + interval '38 hours' where id = $1", [soon]);
    await essentialOwner();
    const ok = await rows<{ status: string }>(db, "select (public.publish_shift($1)).status", [soon]);
    expect(ok[0]!.status).toBe("open");
  });

  it("Essential plan allows one site", async () => {
    await essentialOwner();
    const err = await errorOf(db, "insert into public.sites (company_id, name, address, geo) values ($1, 'Second', '2 Main', private.make_point(32.8, -96.8))", [essential.id]);
    expect(err).toMatch(/plan_cap_sites/);
    await employer();
    const ok = await errorOf(db, "insert into public.sites (company_id, name, address, geo) values ($1, 'Second', '2 Main', private.make_point(32.8, -96.8))", [company.id]);
    expect(ok).toBeNull();
  });

  it("company_usage reports caps and usage", async () => {
    await employer();
    const u = await one<{ u: Record<string, unknown> }>(db, "select public.company_usage() as u");
    expect(u.u.plan_code).toBe("pro");
    expect(u.u.booking_cap).toBe(40);
    expect(u.u.sites_used).toBe(2);
  });
});

describe("matching", () => {
  it("returns eligible officers within radius with the required license, ordered", async () => {
    const shift = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, level: 2 });
    await employer();
    const m = await rows<{ officer_id: string; distance_mi: string }>(db, "select officer_id, distance_mi from public.match_candidates($1)", [shift]);
    const ids = m.map((x) => x.officer_id);
    expect(ids).toContain(o1.id);
    expect(ids).toContain(o2.id);
    expect(ids).not.toContain(farAway.id);
    expect(ids).not.toContain(notVerified.id);
    const armed = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, level: 3 });
    const m3 = await rows<{ officer_id: string }>(db, "select officer_id from public.match_candidates($1)", [armed]);
    expect(m3.map((x) => x.officer_id)).toEqual([o1.id]);
  });
});

describe("accept_shift", () => {
  it("books instantly on auto-accept, prevents overfilling and double booking", async () => {
    const shift = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, needed: 1, fillMode: "auto" });
    await officer(o1);
    const r1 = await one<{ r: { outcome: string; assignment_id: string } }>(db, "select public.accept_shift($1) as r", [shift]);
    expect(r1.r.outcome).toBe("booked");
    const again = await errorOf(db, "select public.accept_shift($1)", [shift]);
    expect(again).toMatch(/shift_unavailable|already_booked/);
    await officer(o2);
    const full = await errorOf(db, "select public.accept_shift($1)", [shift]);
    expect(full).toMatch(/shift_unavailable|shift_full/);
    await asSuper(db);
    const s = await one<{ status: string }>(db, "select status from public.shifts where id = $1", [shift]);
    expect(s.status).toBe("filled");
    const pay = await one<{ officer_pay_cents: number; platform_fee_cents: number; total_cents: number; status: string }>(db, "select officer_pay_cents, platform_fee_cents, total_cents, status from public.payments where assignment_id = $1", [r1.r.assignment_id]);
    expect(pay).toEqual({ officer_pay_cents: 24000, platform_fee_cents: 2400, total_cents: 26400, status: "pending" });
  });

  it("blocks an officer with an overlapping booking", async () => {
    const a = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, startInHours: 50, hours: 8 });
    const b = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, startInHours: 54, hours: 8 });
    await officer(o3);
    await db.query("select public.accept_shift($1)", [a]);
    const err = await errorOf(db, "select public.accept_shift($1)", [b]);
    expect(err).toMatch(/officer_overlap/);
  });

  it("rejects unverified officers with the list of blockers", async () => {
    const shift = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id });
    await officer(notVerified);
    const err = await errorOf(db, "select public.accept_shift($1)", [shift]);
    expect(err).toMatch(/officer_not_eligible/);
    const blockers = await one<{ b: string[] }>(db, "select public.officer_blockers() as b");
    expect(blockers.b).toEqual(expect.arrayContaining(["signup_fee", "background_check", "license"]));
  });

  it("rejects a license level below the requirement", async () => {
    const armed = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, level: 3 });
    await officer(o2);
    const err = await errorOf(db, "select public.accept_shift($1)", [armed]);
    expect(err).toMatch(/license_level/);
  });

  it("review mode creates an application the employer can confirm or decline", async () => {
    const shift = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, needed: 1, fillMode: "review", startInHours: 100 });
    await officer(o1);
    await db.query("select public.accept_shift($1, 'Available all night')", [shift]);
    await officer(o2);
    await db.query("select public.accept_shift($1)", [shift]);
    await employer();
    const apps = await rows<{ id: string; officer_id: string }>(db, "select id, officer_id from public.shift_applications where shift_id = $1 order by created_at", [shift]);
    expect(apps).toHaveLength(2);
    await db.query("select public.confirm_applicant($1)", [apps[0]!.id]);
    const after = await rows<{ officer_id: string; status: string }>(db, "select officer_id, status from public.shift_applications where shift_id = $1 order by created_at", [shift]);
    expect(after.map((a) => a.status)).toEqual(["accepted", "declined"]);
    const err = await errorOf(db, "select public.confirm_applicant($1)", [apps[1]!.id]);
    expect(err).toMatch(/already decided|shift_unavailable/);
  });
});

describe("clock in / out, timesheet, payout math", () => {
  let shift: string;
  let assignment: string;

  beforeAll(async () => {
    shift = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, startInHours: 48, hours: 8, rateCents: 2600 });
    await officer(o2);
    const r = await one<{ r: { assignment_id: string } }>(db, "select public.accept_shift($1) as r", [shift]);
    assignment = r.r.assignment_id;
  });

  it("refuses clock-in before the window opens", async () => {
    await officer(o2);
    const r = await one<{ r: { ok: boolean; reason: string } }>(db, "select public.clock_in($1, 32.789, -96.78) as r", [assignment]);
    expect(r.r).toMatchObject({ ok: false, reason: "too_early" });
  });

  it("blocks clock-in outside the geofence and reports the distance", async () => {
    await asSuper(db);
    await db.query("update public.shifts set start_at = now() + interval '10 minutes', end_at = now() + interval '8 hours 10 minutes' where id = $1", [shift]);
    await officer(o2);
    const r = await one<{ r: { ok: boolean; reason: string; distance_m: number; radius_m: number } }>(db, "select public.clock_in($1, 32.80, -96.80) as r", [assignment]);
    expect(r.r.ok).toBe(false);
    expect(r.r.reason).toBe("outside_geofence");
    expect(r.r.distance_m).toBeGreaterThan(1500);
    expect(r.r.radius_m).toBe(150);
  });

  it("employer override lets the officer clock in from outside the fence", async () => {
    await officer(o2);
    await db.query("select public.request_clock_in_override($1, 32.80, -96.80)", [assignment]);
    await employer();
    await db.query("select public.approve_clock_in_override($1)", [assignment]);
    await officer(o2);
    const r = await one<{ r: { ok: boolean } }>(db, "select public.clock_in($1, 32.80, -96.80) as r", [assignment]);
    expect(r.r.ok).toBe(true);
    await asSuper(db);
    const s = await one<{ status: string }>(db, "select status from public.shifts where id = $1", [shift]);
    expect(s.status).toBe("in_progress");
  });

  it("clock out, approve with partial hours, settlement matches shared math", async () => {
    await asSuper(db);
    await db.query("update public.assignments set clock_in_at = now() - interval '7 hours 30 minutes' where id = $1", [assignment]);
    await officer(o2);
    const out = await one<{ r: { ok: boolean; worked_minutes: number } }>(db, "select public.clock_out($1, 32.789, -96.78, 4, 'quiet night') as r", [assignment]);
    expect(out.r.ok).toBe(true);
    expect(out.r.worked_minutes).toBe(450);
    await officer(o1);
    const notMine = await errorOf(db, "select public.approve_timesheet($1)", [assignment]);
    expect(notMine).toMatch(/not authorized/);
    await employer();
    const approved = await one<{ approved_minutes: number; approval_status: string }>(db, "select (a).approved_minutes, (a).approval_status from public.approve_timesheet($1) a", [assignment]);
    expect(approved).toEqual({ approved_minutes: 450, approval_status: "approved" });
    await asSuper(db);
    const pay = await one<{ officer_pay_cents: number }>(db, "select officer_pay_cents from public.payments where assignment_id = $1", [assignment]);
    expect(pay.officer_pay_cents).toBe(20800); // charged for 8h; payout for 450 min happens in the Edge Function using shared math
    const completed = await one<{ completed_shifts: number }>(db, "select completed_shifts from public.officer_profiles where user_id = $1", [o2.id]);
    expect(completed.completed_shifts).toBe(1);
  });

  it("both sides can rate after approval and the officer average updates", async () => {
    await employer();
    await db.query("select public.rate_assignment($1, 5, array['on_time','professional'], 'Great')", [assignment]);
    await officer(o2);
    await db.query("select public.rate_assignment($1, 4, array[]::text[], 'Clear post orders')", [assignment]);
    await asSuper(db);
    const op = await one<{ rating_avg: string; rating_count: number }>(db, "select rating_avg, rating_count from public.officer_profiles where user_id = $1", [o2.id]);
    expect(Number(op.rating_avg)).toBe(5);
    expect(op.rating_count).toBe(1);
    const r = await rows<{ direction: string }>(db, "select direction from public.ratings where assignment_id = $1 order by direction", [assignment]);
    expect(r.map((x) => x.direction)).toEqual(["employer_to_officer", "officer_to_employer"]);
  });
});

describe("jobs and accountability", () => {
  it("marks no-shows, strikes the officer, refunds (cancels) the payment and reopens the spot as urgent", async () => {
    const shift = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, startInHours: 70 });
    await officer(o3);
    // o3 has a booking at 50h; 70h does not overlap
    const r = await one<{ r: { assignment_id: string } }>(db, "select public.accept_shift($1) as r", [shift]);
    await asSuper(db);
    await db.query("update public.shifts set start_at = now() - interval '45 minutes', end_at = now() + interval '7 hours' where id = $1", [shift]);
    await asService(db);
    const n = await one<{ n: number }>(db, "select private.mark_no_shows() as n");
    expect(n.n).toBe(1);
    await asSuper(db);
    const a = await one<{ status: string }>(db, "select status from public.assignments where id = $1", [r.r.assignment_id]);
    expect(a.status).toBe("no_show");
    const p = await one<{ status: string }>(db, "select status from public.payments where assignment_id = $1", [r.r.assignment_id]);
    expect(p.status).toBe("canceled");
    const s = await one<{ status: string; is_urgent: boolean }>(db, "select status, is_urgent from public.shifts where id = $1", [shift]);
    expect(s).toEqual({ status: "open", is_urgent: true });
    const strikes = await rows(db, "select id from public.strikes where officer_id = $1 and type = 'no_show'", [o3.id]);
    expect(strikes).toHaveLength(1);
  });

  it("deactivates after the second no-show in 90 days and warns one strike away", async () => {
    await asSuper(db);
    const warn = await rows(db, "select id from public.notifications where user_id = $1 and kind = 'account.warning'", [o3.id]);
    expect(warn).toHaveLength(1);
    await db.query("insert into public.strikes (officer_id, type) values ($1, 'no_show')", [o3.id]);
    await asService(db);
    await db.query("select private.run_deactivation_check($1)", [o3.id]);
    await asSuper(db);
    const op = await one<{ account_status: string; is_available: boolean }>(db, "select account_status, is_available from public.officer_profiles where user_id = $1", [o3.id]);
    expect(op).toEqual({ account_status: "deactivated", is_available: false });
    await officer(o3);
    const blocked = await one<{ b: string[] }>(db, "select public.officer_blockers() as b");
    expect(blocked.b).toContain("deactivated");
  });

  it("late cancellation under 12h is a strike; early cancellation is not", async () => {
    const early = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, startInHours: 90 });
    await officer(o1);
    const eligibility = await one<{ b: string[] }>(db, "select public.officer_blockers() as b");
    expect(eligibility.b).toEqual([]);
    const r = await one<{ r: { assignment_id: string } }>(db, "select public.accept_shift($1) as r", [early]);
    const c = await one<{ r: { late_cancellation: boolean } }>(db, "select public.cancel_assignment_by_officer($1, 'sick') as r", [r.r.assignment_id]);
    expect(c.r.late_cancellation).toBe(false);
    const late = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, startInHours: 200 });
    await officer(o1);
    const r2 = await one<{ r: { assignment_id: string } }>(db, "select public.accept_shift($1) as r", [late]);
    await asSuper(db);
    await db.query("update public.shifts set start_at = now() + interval '3 hours', end_at = now() + interval '11 hours' where id = $1", [late]);
    await officer(o1);
    const c2 = await one<{ r: { late_cancellation: boolean } }>(db, "select public.cancel_assignment_by_officer($1) as r", [r2.r.assignment_id]);
    expect(c2.r.late_cancellation).toBe(true);
    await asSuper(db);
    const strikes = await rows(db, "select id from public.strikes where officer_id = $1 and type = 'late_cancel'", [o1.id]);
    expect(strikes).toHaveLength(1);
  });

  it("auto-approves timesheets after 24h", async () => {
    const shift = await seedShift(db, { companyId: company.id, siteId: company.siteId, createdBy: company.owner.id, startInHours: 120, hours: 4, rateCents: 3000 });
    await officer(o2);
    const r = await one<{ r: { assignment_id: string } }>(db, "select public.accept_shift($1) as r", [shift]);
    await asSuper(db);
    await db.query("update public.assignments set status = 'completed', clock_in_at = now() - interval '30 hours', clock_out_at = now() - interval '26 hours' where id = $1", [r.r.assignment_id]);
    await asService(db);
    const n = await one<{ n: number }>(db, "select private.auto_approve_timesheets() as n");
    expect(n.n).toBe(1);
    await asSuper(db);
    const a = await one<{ approval_status: string; approved_minutes: number }>(db, "select approval_status, approved_minutes from public.assignments where id = $1", [r.r.assignment_id]);
    expect(a).toEqual({ approval_status: "auto_approved", approved_minutes: 240 });
  });

  it("license expiry warns at 30/14/3 days and expires past the date, blocking the officer", async () => {
    await asSuper(db);
    await db.query("update public.officer_licenses set expires_on = current_date + 10, warned_30 = false where officer_id = $1", [o2.id]);
    await asService(db);
    let r = await one<{ r: { warned: number; expired: number } }>(db, "select private.process_license_expiry() as r");
    expect(r.r.warned).toBeGreaterThanOrEqual(1);
    await asSuper(db);
    const l = await one<{ warned_14: boolean }>(db, "select warned_14 from public.officer_licenses where officer_id = $1", [o2.id]);
    expect(l.warned_14).toBe(true);
    await db.query("update public.officer_licenses set expires_on = current_date - 1 where officer_id = $1", [o2.id]);
    await asService(db);
    r = await one<{ r: { warned: number; expired: number } }>(db, "select private.process_license_expiry() as r");
    expect(r.r.expired).toBe(1);
    await officer(o2);
    const blockers = await one<{ b: string[] }>(db, "select public.officer_blockers() as b");
    expect(blockers.b).toContain("license");
  });

  it("prunes location pings older than the retention window", async () => {
    await asSuper(db);
    const asg = await one<{ id: string }>(db, "select id from public.assignments where officer_id = $1 and status = 'completed' limit 1", [o2.id]);
    await db.query("insert into public.location_pings (assignment_id, geo, recorded_at) values ($1, private.make_point(32.78, -96.78), now() - interval '100 days')", [asg.id]);
    await asService(db);
    const n = await one<{ n: number }>(db, "select private.prune_location_pings() as n");
    expect(n.n).toBe(1);
  });
});

describe("admin actions", () => {
  it("license review activates a fully verified officer and notifies them", async () => {
    const u = await seedOfficer(db, { name: "New Officer", lat: 32.8, lng: -96.8, eligible: false });
    await asSuper(db);
    await db.query("update public.officer_profiles set signup_fee_paid_at = now(), background_status = 'clear' where user_id = $1", [u.id]);
    const lic = await one<{ id: string }>(db, "insert into public.officer_licenses (officer_id, license_type_id, license_number, expires_on, front_path, back_path) values ($1, (select id from public.license_types where code = 'TX_L2'), 'TX-NEW', current_date + 365, 'f', 'b') returning id", [u.id]);
    const admin = await one<{ id: string }>(db, "insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000ad01', 'a@test.local') returning id");
    await db.query("insert into public.profiles (id, role, full_name) values ($1, 'admin', 'Admin')", [admin.id]);
    await actAs(db, { sub: admin.id, app_role: "admin" });
    await db.query("select public.admin_review_license($1, true)", [lic.id]);
    await asSuper(db);
    const op = await one<{ account_status: string }>(db, "select account_status from public.officer_profiles where user_id = $1", [u.id]);
    expect(op.account_status).toBe("active");
    const n = await rows(db, "select id from public.notifications where user_id = $1 and kind = 'license.approved'", [u.id]);
    expect(n.length).toBeGreaterThanOrEqual(1);
    const audit = await rows(db, "select id from public.audit_log where action = 'license.review'");
    expect(audit).toHaveLength(1);
  });

  it("non-admins cannot call admin functions", async () => {
    await employer();
    const err = await errorOf(db, "select public.admin_set_company_plan($1, 'enterprise')", [company.id]);
    expect(err).toMatch(/not authorized/);
  });
});
