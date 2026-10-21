import "server-only";
import type {
  AdminOverview,
  AssignmentRow,
  AuditLogRow,
  CompanyMemberRow,
  CompanyRow,
  CompanyUsage,
  DisputeRow,
  IncidentReportRow,
  LicenseStatus,
  LicenseTypeRow,
  LocationPingRow,
  OfficerAccountStatus,
  OfficerCertificationRow,
  OfficerLicenseRow,
  OfficerProfileRow,
  PaymentRow,
  PlanRow,
  PlatformSettingRow,
  ProfileRow,
  RatingRow,
  ShiftApplicationRow,
  ShiftCost,
  ShiftRow,
  ShiftStatus,
  SiteRow,
  StrikeRow,
  SubscriptionStatus,
} from "@shiftshield/shared";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { DbClient } from "@/lib/supabase/server";
import { groupBy, indexBy, uniq } from "./format";

/**
 * Read side of the admin panel. Every function takes the signed-in admin's session client so
 * RLS (`private.is_admin()`) is what grants access. Joins are done in memory: the shared
 * `Database` type is hand-maintained without relationship metadata, so embedded selects would
 * not be typed, and admin result sets are small.
 */

class QueryError extends Error {}

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new QueryError(`${what}: ${res.error.message}`);
  if (res.data === null) throw new QueryError(`${what}: no data`);
  return res.data;
}

/** `.maybeSingle()` result: throws on PostgREST errors, returns null when the row does not exist. */
function maybe<R extends { data: unknown; error: { message: string } | null }>(
  res: R,
  what: string,
): NonNullable<Extract<R, { error: null }>["data"]> | null {
  if (res.error) throw new QueryError(`${what}: ${res.error.message}`);
  return (res.data ?? null) as NonNullable<Extract<R, { error: null }>["data"]> | null;
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

/** Run a loader and turn thrown PostgREST errors into a renderable state. */
export async function attempt<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[admin] query failed", message);
    return { ok: false, error: message };
  }
}

/** Escape user input used inside PostgREST `or()` filters. */
function like(q: string): string {
  return `%${q.replace(/[%,()."\\]/g, " ").trim()}%`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

// ---------- Shared lookups ----------

export async function fetchProfiles(db: DbClient, ids: readonly string[]) {
  const list = uniq(ids.filter(Boolean));
  if (list.length === 0) return new Map<string, ProfileRow>();
  const rows = must(await db.from("profiles").select("*").in("id", list), "profiles");
  return indexBy(rows, (r) => r.id);
}

async function fetchCompaniesById(db: DbClient, ids: readonly string[]) {
  const list = uniq(ids.filter(Boolean));
  if (list.length === 0) return new Map<string, CompanyRow>();
  const rows = must(await db.from("companies").select("*").in("id", list), "companies");
  return indexBy(rows, (r) => r.id);
}

async function fetchSitesById(db: DbClient, ids: readonly string[]) {
  const list = uniq(ids.filter(Boolean));
  if (list.length === 0) return new Map<string, SiteRow>();
  const rows = must(await db.from("sites").select("*").in("id", list), "sites");
  return indexBy(rows, (r) => r.id);
}

async function fetchShiftsById(db: DbClient, ids: readonly string[]) {
  const list = uniq(ids.filter(Boolean));
  if (list.length === 0) return new Map<string, ShiftRow>();
  const rows = must(await db.from("shifts").select("*").in("id", list), "shifts");
  return indexBy(rows, (r) => r.id);
}

export async function fetchLicenseTypes(db: DbClient) {
  const rows = must(await db.from("license_types").select("*").order("level"), "license_types");
  return indexBy(rows, (r) => r.id);
}

export async function fetchPlans(db: DbClient): Promise<PlanRow[]> {
  return must(await db.from("plans").select("*").order("priority_rank").order("price_cents"), "plans");
}

// ---------- Nav + overview ----------

export async function fetchNavCounts(db: DbClient) {
  try {
    const [lic, dis] = await Promise.all([
      db.from("officer_licenses").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);
    return { licensesPending: lic.count ?? 0, openDisputes: dis.count ?? 0 };
  } catch {
    return null;
  }
}

export async function fetchOverview(db: DbClient): Promise<AdminOverview> {
  return must(await db.rpc("admin_overview"), "admin_overview");
}

// ---------- Licenses ----------

export interface LicenseListItem {
  license: OfficerLicenseRow;
  type: LicenseTypeRow | null;
  profile: ProfileRow | null;
}

export async function fetchLicenses(
  db: DbClient,
  status: LicenseStatus | "all",
  limit = 200,
): Promise<LicenseListItem[]> {
  let q = db
    .from("officer_licenses")
    .select("*")
    .order("created_at", { ascending: status === "pending" })
    .limit(limit);
  if (status !== "all") q = q.eq("status", status);
  const licenses = must(await q, "officer_licenses");
  const [types, profiles] = await Promise.all([
    fetchLicenseTypes(db),
    fetchProfiles(
      db,
      licenses.map((l) => l.officer_id),
    ),
  ]);
  return licenses.map((license) => ({
    license,
    type: types.get(license.license_type_id) ?? null,
    profile: profiles.get(license.officer_id) ?? null,
  }));
}

export async function fetchLicenseCounts(db: DbClient) {
  const statuses: LicenseStatus[] = ["pending", "approved", "rejected", "expired", "suspended"];
  const results = await Promise.all(
    statuses.map((s) =>
      db.from("officer_licenses").select("id", { count: "exact", head: true }).eq("status", s),
    ),
  );
  const out: Record<string, number> = {};
  statuses.forEach((s, i) => {
    out[s] = results[i]?.count ?? 0;
  });
  return out;
}

export interface LicenseDetail extends LicenseListItem {
  officer: OfficerProfileRow | null;
  reviewer: ProfileRow | null;
  otherLicenses: Array<{ license: OfficerLicenseRow; type: LicenseTypeRow | null }>;
}

export async function fetchLicenseDetail(db: DbClient, id: string): Promise<LicenseDetail | null> {
  const license = maybe(await db.from("officer_licenses").select("*").eq("id", id).maybeSingle(), "license");
  if (!license) return null;
  const [types, profiles, officer, others] = await Promise.all([
    fetchLicenseTypes(db),
    fetchProfiles(db, [license.officer_id, license.reviewed_by ?? ""]),
    db.from("officer_profiles").select("*").eq("user_id", license.officer_id).maybeSingle(),
    db
      .from("officer_licenses")
      .select("*")
      .eq("officer_id", license.officer_id)
      .neq("id", license.id)
      .order("created_at", { ascending: false }),
  ]);
  return {
    license,
    type: types.get(license.license_type_id) ?? null,
    profile: profiles.get(license.officer_id) ?? null,
    reviewer: license.reviewed_by ? (profiles.get(license.reviewed_by) ?? null) : null,
    officer: maybe(officer, "officer_profile"),
    otherLicenses: must(others, "other licenses").map((l) => ({
      license: l,
      type: types.get(l.license_type_id) ?? null,
    })),
  };
}

// ---------- Storage (signed URLs) ----------

/**
 * Signed URLs for private buckets. The service-role client is preferred (never leaves the
 * server); when SUPABASE_SERVICE_ROLE_KEY is absent the admin's own session is used, which the
 * storage policies also allow (`private.is_admin()`).
 */
export async function signedUrls(
  session: DbClient,
  bucket: "licenses" | "incident-photos" | "certifications",
  paths: readonly string[],
  expiresInSec = 600,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = uniq(paths.filter(Boolean));
  if (list.length === 0) return out;
  const client = getSupabaseAdmin() ?? session;
  const { data, error } = await client.storage.from(bucket).createSignedUrls(list, expiresInSec);
  if (error) {
    console.error("[admin] signed urls failed", error.message);
    return out;
  }
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out.set(item.path, item.signedUrl);
  }
  return out;
}

// ---------- Officers ----------

export interface OfficerListItem {
  officer: OfficerProfileRow;
  profile: ProfileRow | null;
}

export async function fetchOfficers(
  db: DbClient,
  filters: { q?: string; status?: OfficerAccountStatus },
  limit = 200,
): Promise<OfficerListItem[]> {
  if (filters.q) {
    const term = like(filters.q);
    const profiles = must(
      await db
        .from("profiles")
        .select("*")
        .eq("role", "officer")
        .or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
        .limit(limit),
      "profiles",
    );
    if (profiles.length === 0) return [];
    let q = db
      .from("officer_profiles")
      .select("*")
      .in(
        "user_id",
        profiles.map((p) => p.id),
      );
    if (filters.status) q = q.eq("account_status", filters.status);
    const officers = must(await q.order("created_at", { ascending: false }), "officer_profiles");
    const byId = indexBy(profiles, (p) => p.id);
    return officers.map((officer) => ({ officer, profile: byId.get(officer.user_id) ?? null }));
  }
  let q = db.from("officer_profiles").select("*").order("created_at", { ascending: false }).limit(limit);
  if (filters.status) q = q.eq("account_status", filters.status);
  const officers = must(await q, "officer_profiles");
  const profiles = await fetchProfiles(
    db,
    officers.map((o) => o.user_id),
  );
  return officers.map((officer) => ({ officer, profile: profiles.get(officer.user_id) ?? null }));
}

export interface OfficerDetail extends OfficerListItem {
  licenses: Array<{ license: OfficerLicenseRow; type: LicenseTypeRow | null }>;
  certifications: OfficerCertificationRow[];
  strikes: StrikeRow[];
  ratings: Array<{ rating: RatingRow; rater: ProfileRow | null }>;
  assignments: Array<{ assignment: AssignmentRow; shift: ShiftRow | null; company: CompanyRow | null }>;
  payments: PaymentRow[];
  blockers: string[];
}

export async function fetchOfficerDetail(db: DbClient, id: string): Promise<OfficerDetail | null> {
  const officer = maybe(await db.from("officer_profiles").select("*").eq("user_id", id).maybeSingle(), "officer");
  if (!officer) return null;
  const [profiles, types, licenses, certs, strikes, ratings, assignments, payments, blockers] =
    await Promise.all([
      fetchProfiles(db, [id]),
      fetchLicenseTypes(db),
      db.from("officer_licenses").select("*").eq("officer_id", id).order("created_at", { ascending: false }),
      db.from("officer_certifications").select("*").eq("officer_id", id).order("created_at", { ascending: false }),
      db.from("strikes").select("*").eq("officer_id", id).order("created_at", { ascending: false }),
      db
        .from("ratings")
        .select("*")
        .eq("ratee_id", id)
        .eq("direction", "employer_to_officer")
        .order("created_at", { ascending: false })
        .limit(20),
      db.from("assignments").select("*").eq("officer_id", id).order("created_at", { ascending: false }).limit(20),
      db.from("payments").select("*").eq("officer_id", id).order("created_at", { ascending: false }).limit(20),
      db.rpc("officer_blockers", { p_officer_id: id }),
    ]);
  const ratingRows = must(ratings, "ratings");
  const assignmentRows = must(assignments, "assignments");
  const [raters, shifts] = await Promise.all([
    fetchProfiles(
      db,
      ratingRows.map((r) => r.rater_id),
    ),
    fetchShiftsById(
      db,
      assignmentRows.map((a) => a.shift_id),
    ),
  ]);
  const companies = await fetchCompaniesById(db, Array.from(shifts.values()).map((s) => s.company_id));
  return {
    officer,
    profile: profiles.get(id) ?? null,
    licenses: must(licenses, "licenses").map((l) => ({ license: l, type: types.get(l.license_type_id) ?? null })),
    certifications: must(certs, "certifications"),
    strikes: must(strikes, "strikes"),
    ratings: ratingRows.map((rating) => ({ rating, rater: raters.get(rating.rater_id) ?? null })),
    assignments: assignmentRows.map((assignment) => {
      const shift = shifts.get(assignment.shift_id) ?? null;
      return { assignment, shift, company: shift ? (companies.get(shift.company_id) ?? null) : null };
    }),
    payments: must(payments, "payments"),
    blockers: blockers.error ? [] : (blockers.data ?? []),
  };
}

// ---------- Companies ----------

export interface CompanyListItem {
  company: CompanyRow;
  plan: PlanRow | null;
}

export async function fetchCompanies(
  db: DbClient,
  filters: { q?: string; plan?: string; subscription?: SubscriptionStatus },
  limit = 200,
): Promise<CompanyListItem[]> {
  const plans = await fetchPlans(db);
  const planById = indexBy(plans, (p) => p.id);
  let q = db.from("companies").select("*").order("created_at", { ascending: false }).limit(limit);
  if (filters.q) {
    const term = like(filters.q);
    q = q.or(`name.ilike.${term},dba.ilike.${term},billing_email.ilike.${term},phone.ilike.${term}`);
  }
  if (filters.plan === "none") q = q.is("plan_id", null);
  else if (filters.plan) {
    const plan = plans.find((p) => p.code === filters.plan);
    if (plan) q = q.eq("plan_id", plan.id);
  }
  if (filters.subscription) q = q.eq("subscription_status", filters.subscription);
  const companies = must(await q, "companies");
  return companies.map((company) => ({
    company,
    plan: company.plan_id ? (planById.get(company.plan_id) ?? null) : null,
  }));
}

export interface CompanyDetail extends CompanyListItem {
  members: Array<{ member: CompanyMemberRow; profile: ProfileRow | null }>;
  sites: SiteRow[];
  usage: CompanyUsage | null;
  usageError: string | null;
  shifts: Array<{ shift: ShiftRow; site: SiteRow | null }>;
  payments: PaymentRow[];
  plans: PlanRow[];
}

export async function fetchCompanyDetail(db: DbClient, id: string): Promise<CompanyDetail | null> {
  const company = maybe(await db.from("companies").select("*").eq("id", id).maybeSingle(), "company");
  if (!company) return null;
  const [plans, members, sites, usage, shifts, payments] = await Promise.all([
    fetchPlans(db),
    db.from("company_members").select("*").eq("company_id", id).order("created_at"),
    db.from("sites").select("*").eq("company_id", id).order("name"),
    db.rpc("company_usage", { p_company_id: id }),
    db.from("shifts").select("*").eq("company_id", id).order("start_at", { ascending: false }).limit(20),
    db.from("payments").select("*").eq("company_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const memberRows = must(members, "company_members");
  const siteRows = must(sites, "sites");
  const siteById = indexBy(siteRows, (s) => s.id);
  const profiles = await fetchProfiles(
    db,
    memberRows.map((m) => m.user_id),
  );
  return {
    company,
    plan: company.plan_id ? (plans.find((p) => p.id === company.plan_id) ?? null) : null,
    members: memberRows.map((member) => ({ member, profile: profiles.get(member.user_id) ?? null })),
    sites: siteRows,
    usage: usage.error ? null : usage.data,
    usageError: usage.error ? usage.error.message : null,
    shifts: must(shifts, "shifts").map((shift) => ({ shift, site: siteById.get(shift.site_id) ?? null })),
    payments: must(payments, "payments"),
    plans,
  };
}

// ---------- Shifts ----------

export interface ShiftListItem {
  shift: ShiftRow;
  company: CompanyRow | null;
  site: SiteRow | null;
  booked: number;
}

export async function fetchShifts(
  db: DbClient,
  filters: { q?: string; status?: ShiftStatus; from?: string; to?: string },
  limit = 200,
): Promise<ShiftListItem[]> {
  let q = db.from("shifts").select("*").order("start_at", { ascending: false }).limit(limit);
  if (filters.q) {
    if (isUuid(filters.q)) q = q.eq("id", filters.q);
    else q = q.ilike("title", like(filters.q));
  }
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.from) q = q.gte("start_at", `${filters.from}T00:00:00-05:00`);
  if (filters.to) q = q.lte("start_at", `${filters.to}T23:59:59-05:00`);
  const shifts = must(await q, "shifts");
  if (shifts.length === 0) return [];
  const [companies, sites, assignments] = await Promise.all([
    fetchCompaniesById(
      db,
      shifts.map((s) => s.company_id),
    ),
    fetchSitesById(
      db,
      shifts.map((s) => s.site_id),
    ),
    db
      .from("assignments")
      .select("shift_id,status")
      .in(
        "shift_id",
        shifts.map((s) => s.id),
      )
      .in("status", ["confirmed", "clocked_in", "completed"]),
  ]);
  const booked = groupBy(must(assignments, "assignments"), (a) => a.shift_id);
  return shifts.map((shift) => ({
    shift,
    company: companies.get(shift.company_id) ?? null,
    site: sites.get(shift.site_id) ?? null,
    booked: booked.get(shift.id)?.length ?? 0,
  }));
}

export interface AssignmentDetail {
  assignment: AssignmentRow;
  profile: ProfileRow | null;
  payment: PaymentRow | null;
  dispute: DisputeRow | null;
  pings: LocationPingRow[];
}

export interface ShiftDetail {
  shift: ShiftRow;
  company: CompanyRow | null;
  site: SiteRow | null;
  cost: ShiftCost | null;
  costError: string | null;
  applications: Array<{ application: ShiftApplicationRow; profile: ProfileRow | null }>;
  assignments: AssignmentDetail[];
}

async function fetchAssignmentExtras(db: DbClient, assignments: AssignmentRow[], pingLimit: number) {
  const ids = assignments.map((a) => a.id);
  if (ids.length === 0) {
    return {
      profiles: new Map<string, ProfileRow>(),
      payments: new Map<string, PaymentRow>(),
      disputes: new Map<string, DisputeRow>(),
      pings: new Map<string, LocationPingRow[]>(),
    };
  }
  const [profiles, payments, disputes, pings] = await Promise.all([
    fetchProfiles(
      db,
      assignments.map((a) => a.officer_id),
    ),
    db.from("payments").select("*").in("assignment_id", ids),
    db.from("disputes").select("*").in("assignment_id", ids),
    db
      .from("location_pings")
      .select("*")
      .in("assignment_id", ids)
      .order("recorded_at", { ascending: true })
      .limit(pingLimit),
  ]);
  return {
    profiles,
    payments: indexBy(must(payments, "payments"), (p) => p.assignment_id),
    disputes: indexBy(must(disputes, "disputes"), (d) => d.assignment_id),
    pings: groupBy(must(pings, "location_pings"), (p) => p.assignment_id),
  };
}

export async function fetchShiftDetail(db: DbClient, id: string): Promise<ShiftDetail | null> {
  const shift = maybe(await db.from("shifts").select("*").eq("id", id).maybeSingle(), "shift");
  if (!shift) return null;
  const [companies, sites, cost, applications, assignments] = await Promise.all([
    fetchCompaniesById(db, [shift.company_id]),
    fetchSitesById(db, [shift.site_id]),
    db.rpc("shift_cost", { p_shift_id: id }),
    db.from("shift_applications").select("*").eq("shift_id", id).order("created_at"),
    db.from("assignments").select("*").eq("shift_id", id).order("created_at"),
  ]);
  const applicationRows = must(applications, "applications");
  const assignmentRows = must(assignments, "assignments");
  const [applicants, extras] = await Promise.all([
    fetchProfiles(
      db,
      applicationRows.map((a) => a.officer_id),
    ),
    fetchAssignmentExtras(db, assignmentRows, 2000),
  ]);
  return {
    shift,
    company: companies.get(shift.company_id) ?? null,
    site: sites.get(shift.site_id) ?? null,
    cost: cost.error ? null : cost.data,
    costError: cost.error ? cost.error.message : null,
    applications: applicationRows.map((application) => ({
      application,
      profile: applicants.get(application.officer_id) ?? null,
    })),
    assignments: assignmentRows.map((assignment) => ({
      assignment,
      profile: extras.profiles.get(assignment.officer_id) ?? null,
      payment: extras.payments.get(assignment.id) ?? null,
      dispute: extras.disputes.get(assignment.id) ?? null,
      pings: extras.pings.get(assignment.id) ?? [],
    })),
  };
}

// ---------- Disputes ----------

export interface DisputeListItem {
  dispute: DisputeRow;
  assignment: AssignmentRow | null;
  shift: ShiftRow | null;
  company: CompanyRow | null;
  officer: ProfileRow | null;
  openedBy: ProfileRow | null;
}

export async function fetchDisputes(
  db: DbClient,
  status: "open" | "resolved" | "all",
  limit = 200,
): Promise<DisputeListItem[]> {
  let q = db.from("disputes").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status === "open") q = q.eq("status", "open");
  if (status === "resolved") q = q.neq("status", "open");
  const disputes = must(await q, "disputes");
  if (disputes.length === 0) return [];
  const assignments = must(
    await db
      .from("assignments")
      .select("*")
      .in(
        "id",
        disputes.map((d) => d.assignment_id),
      ),
    "assignments",
  );
  const assignmentById = indexBy(assignments, (a) => a.id);
  const [shifts, profiles] = await Promise.all([
    fetchShiftsById(
      db,
      assignments.map((a) => a.shift_id),
    ),
    fetchProfiles(db, [...assignments.map((a) => a.officer_id), ...disputes.map((d) => d.opened_by)]),
  ]);
  const companies = await fetchCompaniesById(db, Array.from(shifts.values()).map((s) => s.company_id));
  return disputes.map((dispute) => {
    const assignment = assignmentById.get(dispute.assignment_id) ?? null;
    const shift = assignment ? (shifts.get(assignment.shift_id) ?? null) : null;
    return {
      dispute,
      assignment,
      shift,
      company: shift ? (companies.get(shift.company_id) ?? null) : null,
      officer: assignment ? (profiles.get(assignment.officer_id) ?? null) : null,
      openedBy: profiles.get(dispute.opened_by) ?? null,
    };
  });
}

export interface DisputeDetail extends DisputeListItem {
  site: SiteRow | null;
  payment: PaymentRow | null;
  pings: LocationPingRow[];
  resolver: ProfileRow | null;
}

export async function fetchDisputeDetail(db: DbClient, id: string): Promise<DisputeDetail | null> {
  const dispute = maybe(await db.from("disputes").select("*").eq("id", id).maybeSingle(), "dispute");
  if (!dispute) return null;
  const assignment = maybe(
    await db.from("assignments").select("*").eq("id", dispute.assignment_id).maybeSingle(),
    "assignment",
  );
  const shift = assignment
    ? maybe(await db.from("shifts").select("*").eq("id", assignment.shift_id).maybeSingle(), "shift")
    : null;
  const [profiles, companies, sites, extras] = await Promise.all([
    fetchProfiles(db, [assignment?.officer_id ?? "", dispute.opened_by, dispute.resolved_by ?? ""]),
    fetchCompaniesById(db, shift ? [shift.company_id] : []),
    fetchSitesById(db, shift ? [shift.site_id] : []),
    fetchAssignmentExtras(db, assignment ? [assignment] : [], 2000),
  ]);
  return {
    dispute,
    assignment,
    shift,
    company: shift ? (companies.get(shift.company_id) ?? null) : null,
    site: shift ? (sites.get(shift.site_id) ?? null) : null,
    officer: assignment ? (profiles.get(assignment.officer_id) ?? null) : null,
    openedBy: profiles.get(dispute.opened_by) ?? null,
    resolver: dispute.resolved_by ? (profiles.get(dispute.resolved_by) ?? null) : null,
    payment: assignment ? (extras.payments.get(assignment.id) ?? null) : null,
    pings: assignment ? (extras.pings.get(assignment.id) ?? []) : [],
  };
}

// ---------- Incidents ----------

export interface IncidentListItem {
  incident: IncidentReportRow;
  shift: ShiftRow | null;
  company: CompanyRow | null;
  officer: ProfileRow | null;
}

export async function fetchIncidents(db: DbClient, limit = 200): Promise<IncidentListItem[]> {
  const incidents = must(
    await db.from("incident_reports").select("*").order("occurred_at", { ascending: false }).limit(limit),
    "incident_reports",
  );
  if (incidents.length === 0) return [];
  const [shifts, companies, profiles] = await Promise.all([
    fetchShiftsById(
      db,
      incidents.map((i) => i.shift_id),
    ),
    fetchCompaniesById(
      db,
      incidents.map((i) => i.company_id),
    ),
    fetchProfiles(
      db,
      incidents.map((i) => i.officer_id),
    ),
  ]);
  return incidents.map((incident) => ({
    incident,
    shift: shifts.get(incident.shift_id) ?? null,
    company: companies.get(incident.company_id) ?? null,
    officer: profiles.get(incident.officer_id) ?? null,
  }));
}

export interface IncidentDetail extends IncidentListItem {
  site: SiteRow | null;
  acknowledgedBy: ProfileRow | null;
}

export async function fetchIncidentDetail(db: DbClient, id: string): Promise<IncidentDetail | null> {
  const incident = maybe(await db.from("incident_reports").select("*").eq("id", id).maybeSingle(), "incident");
  if (!incident) return null;
  const [shifts, companies, profiles] = await Promise.all([
    fetchShiftsById(db, [incident.shift_id]),
    fetchCompaniesById(db, [incident.company_id]),
    fetchProfiles(db, [incident.officer_id, incident.acknowledged_by ?? ""]),
  ]);
  const shift = shifts.get(incident.shift_id) ?? null;
  const sites = await fetchSitesById(db, shift ? [shift.site_id] : []);
  return {
    incident,
    shift,
    site: shift ? (sites.get(shift.site_id) ?? null) : null,
    company: companies.get(incident.company_id) ?? null,
    officer: profiles.get(incident.officer_id) ?? null,
    acknowledgedBy: incident.acknowledged_by ? (profiles.get(incident.acknowledged_by) ?? null) : null,
  };
}

// ---------- Settings ----------

export async function fetchPlatformSettings(db: DbClient): Promise<PlatformSettingRow[]> {
  return must(await db.from("platform_settings").select("*").order("key"), "platform_settings");
}

// ---------- Audit log ----------

export const AUDIT_PAGE_SIZE = 50;

export interface AuditPage {
  rows: Array<{ entry: AuditLogRow; actor: ProfileRow | null }>;
  total: number;
  page: number;
  pageCount: number;
}

export async function fetchAuditLog(
  db: DbClient,
  filters: { page: number; entity?: string; action?: string; entityId?: string },
): Promise<AuditPage> {
  const page = Math.max(1, filters.page);
  const from = (page - 1) * AUDIT_PAGE_SIZE;
  let q = db
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);
  if (filters.entity) q = q.eq("entity_type", filters.entity);
  if (filters.action) q = q.ilike("action", like(filters.action));
  if (filters.entityId) q = q.eq("entity_id", filters.entityId);
  const res = await q;
  const rows = must(res, "audit_log");
  const actors = await fetchProfiles(
    db,
    rows.map((r) => r.actor_id ?? ""),
  );
  const total = res.count ?? rows.length;
  return {
    rows: rows.map((entry) => ({ entry, actor: entry.actor_id ? (actors.get(entry.actor_id) ?? null) : null })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  };
}
