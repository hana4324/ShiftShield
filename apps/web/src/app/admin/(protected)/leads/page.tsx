import type { Metadata } from "next";
import Link from "next/link";
import { WAITLIST_STATUSES } from "@shiftshield/shared";
import { updateLeadStatus } from "@/app/actions/admin";
import { buttonClasses } from "@/components/ui/button";
import { describeLead, fetchLeads, type LeadFilters, type LeadRow } from "@/lib/leads";

export const metadata: Metadata = { title: "Waitlist leads" };

const statusTone: Record<LeadRow["status"], string> = {
  new: "bg-status-amber/15 text-amber-700",
  contacted: "bg-blue-600/10 text-blue-700",
  pilot: "bg-status-green/15 text-green-700",
  declined: "bg-status-gray/20 text-navy-950/60",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const kind = one("kind");
  const status = one("status");
  return {
    kind: kind === "employer" || kind === "officer" ? kind : undefined,
    status: (WAITLIST_STATUSES as readonly string[]).includes(status)
      ? (status as LeadFilters["status"])
      : undefined,
    q: one("q").slice(0, 80) || undefined,
  };
}

function LeadCard({ row }: { row: LeadRow }) {
  const d = describeLead(row);
  return (
    <li className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-950/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase ${statusTone[row.status]}`}
            >
              {row.status}
            </span>
            <span className="rounded-full bg-navy-950/5 px-2.5 py-0.5 text-xs font-semibold text-navy-950/70">
              {row.kind}
            </span>
            <span className="text-xs text-steel-400">{fmtDate(row.created_at)}</span>
          </div>
          <h2 className="mt-2 text-lg font-extrabold tracking-tight">
            {row.kind === "employer" ? row.company_name : row.contact_name}
          </h2>
          <p className="text-sm text-navy-950/70">
            {row.kind === "employer" ? (
              <>
                {row.contact_name}
                {row.title ? `, ${row.title}` : ""} &middot; {d.companyType} &middot; {row.city}
              </>
            ) : (
              <>
                {d.license} &middot; {row.city}
              </>
            )}
          </p>
          <p className="mt-1 text-sm">
            <a className="font-medium text-blue-700 hover:underline" href={`mailto:${row.email}`}>
              {row.email}
            </a>
            <span className="text-steel-400"> &middot; </span>
            <a className="font-medium text-blue-700 hover:underline" href={`tel:${row.phone}`}>
              {row.phone}
            </a>
          </p>
        </div>

        <form action={updateLeadStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={row.id} />
          <label htmlFor={`status-${row.id}`} className="sr-only">
            Status
          </label>
          <select
            id={`status-${row.id}`}
            name="status"
            defaultValue={row.status}
            className="h-11 rounded-xl border border-navy-950/15 bg-white px-3 text-sm font-medium focus-ring"
          >
            {WAITLIST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClasses("white", "md")}>
            Save
          </button>
        </form>
      </div>

      {row.kind === "employer" ? (
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold tracking-wider text-steel-400 uppercase">Sites</dt>
            <dd className="font-semibold">{row.site_count ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wider text-steel-400 uppercase">
              Shifts / mo
            </dt>
            <dd className="font-semibold">{row.shifts_per_month ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wider text-steel-400 uppercase">
              Timeline
            </dt>
            <dd className="font-semibold">{d.timeline || "-"}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <dt className="text-xs font-semibold tracking-wider text-steel-400 uppercase">
              Shift types
            </dt>
            <dd className="font-semibold">{d.shiftTypes || "-"}</dd>
          </div>
        </dl>
      ) : null}

      {row.notes ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-navy-950/80">
          {row.notes}
        </p>
      ) : null}
      {row.admin_notes ? (
        <p className="mt-2 text-sm text-navy-950/60">
          <span className="font-semibold">Admin notes:</span> {row.admin_notes}
        </p>
      ) : null}
    </li>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const { rows, configured, error } = await fetchLeads(filters);
  const exportQs = new URLSearchParams(
    Object.entries(filters).filter((e): e is [string, string] => typeof e[1] === "string"),
  ).toString();

  const counts = {
    total: rows.length,
    employers: rows.filter((r) => r.kind === "employer").length,
    officers: rows.filter((r) => r.kind === "officer").length,
    new: rows.filter((r) => r.status === "new").length,
  };

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Waitlist leads</h1>
          <p className="mt-1 text-sm text-navy-950/60">
            {counts.total} shown &middot; {counts.employers} employers &middot; {counts.officers}{" "}
            officers &middot; {counts.new} new
          </p>
        </div>
        <Link
          href={`/admin/leads/export${exportQs ? `?${exportQs}` : ""}`}
          className={buttonClasses("primary", "md")}
          prefetch={false}
        >
          Export CSV
        </Link>
      </div>

      <form
        method="get"
        className="mt-6 grid gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy-950/5 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <div>
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="Search company, name, email, city"
            className="h-11 w-full rounded-xl border border-navy-950/15 px-4 text-sm focus-ring"
          />
        </div>
        <div>
          <label htmlFor="kind" className="sr-only">
            Kind
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue={filters.kind ?? ""}
            className="h-11 rounded-xl border border-navy-950/15 bg-white px-3 text-sm focus-ring"
          >
            <option value="">All kinds</option>
            <option value="employer">Employers</option>
            <option value="officer">Officers</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-11 rounded-xl border border-navy-950/15 bg-white px-3 text-sm focus-ring"
          >
            <option value="">All statuses</option>
            {WAITLIST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClasses("white", "md")}>
          Filter
        </button>
      </form>

      {!configured ? (
        <p className="mt-6 rounded-2xl bg-status-amber/10 p-5 text-sm text-navy-950">
          Supabase is not configured. Set{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to load leads.
        </p>
      ) : error ? (
        <p role="alert" className="mt-6 rounded-2xl bg-status-red/10 p-5 text-sm text-status-red">
          Could not load leads: {error}
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card ring-1 ring-navy-950/5">
          <p className="text-lg font-bold">No leads yet</p>
          <p className="mt-1 text-sm text-navy-950/60">
            Leads from the landing page forms will show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((r) => (
            <LeadCard key={r.id} row={r} />
          ))}
        </ul>
      )}
    </main>
  );
}
