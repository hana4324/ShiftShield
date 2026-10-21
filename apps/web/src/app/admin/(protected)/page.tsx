import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, ErrorPanel, NotConfigured, PageHeader, Skeleton, StatTile } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtMoney, fmtPct, titleCase } from "@/lib/admin/format";
import { attempt, fetchOverview } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Overview" };

async function Overview() {
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="the overview" />;
  const res = await attempt(() => fetchOverview(admin.db));
  if (!res.ok) return <ErrorPanel message={`Could not load admin_overview: ${res.error}`} />;
  const o = res.data;
  const officers = o.officers_by_status ?? {};
  const officerTotal = Object.values(officers).reduce((a, b) => a + (b ?? 0), 0);
  const plans = Object.entries(o.companies_by_plan ?? {});
  const companyTotal = plans.reduce((a, [, n]) => a + n, 0);

  const attention: Array<{ label: string; count: number; href: string }> = [
    { label: "Licenses waiting for review", count: o.licenses_pending, href: "/admin/licenses" },
    { label: "Open timesheet disputes", count: o.open_disputes, href: "/admin/disputes" },
    { label: "Incident reports in the last 7 days", count: o.incidents_7d, href: "/admin/incidents" },
    { label: "New waitlist leads", count: o.waitlist_new, href: "/admin/leads?status=new" },
    {
      label: "Officers still onboarding",
      count: officers.onboarding ?? 0,
      href: "/admin/officers?status=onboarding",
    },
    { label: "Suspended officers", count: officers.suspended ?? 0, href: "/admin/officers?status=suspended" },
  ].filter((a) => a.count > 0);

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Licenses pending"
          value={o.licenses_pending}
          href="/admin/licenses"
          tone={o.licenses_pending > 0 ? "warn" : "default"}
          hint="Review queue"
        />
        <StatTile
          label="Open disputes"
          value={o.open_disputes}
          href="/admin/disputes"
          tone={o.open_disputes > 0 ? "alert" : "default"}
          hint="Need an admin decision"
        />
        <StatTile label="Shifts this week" value={o.shifts_this_week} href="/admin/shifts" hint="Published, Mon-Sun" />
        <StatTile label="Fill rate (30d)" value={fmtPct(o.fill_rate_pct)} hint="Filled / posted" />
        <StatTile label="Gross volume (30d)" value={fmtMoney(o.gross_volume_cents_30d)} hint="Authorized + captured" />
        <StatTile label="Platform fees (30d)" value={fmtMoney(o.platform_fees_cents_30d)} hint="Captured fees" />
        <StatTile label="MRR" value={fmtMoney(o.mrr_cents)} hint="Active subscriptions" href="/admin/companies" />
        <StatTile label="Incidents (7d)" value={o.incidents_7d} href="/admin/incidents" tone={o.incidents_7d > 0 ? "warn" : "default"} />
        <StatTile label="Officers" value={officerTotal} href="/admin/officers" hint={describeCounts(officers)} />
        <StatTile label="Companies" value={companyTotal} href="/admin/companies" hint={describeCounts(Object.fromEntries(plans))} />
        <StatTile label="New leads" value={o.waitlist_new} href="/admin/leads?status=new" hint="Waitlist, status new" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Needs attention">
          {attention.length === 0 ? (
            <p className="text-sm text-navy-950/60">Nothing waiting. Queues are clear.</p>
          ) : (
            <ul className="divide-y divide-navy-950/5">
              {attention.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm font-semibold hover:text-blue-700 focus-ring rounded"
                  >
                    <span>{a.label}</span>
                    <span className="rounded-full bg-status-amber/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 tabular-nums">
                      {a.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Breakdown">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-wider text-steel-400 uppercase">Officers by status</p>
              <CountList counts={officers} hrefPrefix="/admin/officers?status=" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wider text-steel-400 uppercase">Companies by plan</p>
              <CountList counts={Object.fromEntries(plans)} hrefPrefix="/admin/companies?plan=" />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function describeCounts(counts: Record<string, number | undefined>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`);
  return parts.length ? parts.join(" / ") : "none yet";
}

function CountList({ counts, hrefPrefix }: { counts: Record<string, number | undefined>; hrefPrefix: string }) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return <p className="mt-1 text-sm text-navy-950/60">None yet</p>;
  return (
    <ul className="mt-1 space-y-1 text-sm">
      {entries.map(([k, n]) => (
        <li key={k} className="flex justify-between">
          <Link href={`${hrefPrefix}${k}`} className="hover:text-blue-700 hover:underline">
            {titleCase(k)}
          </Link>
          <span className="font-semibold tabular-nums">{n ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminIndex() {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Overview" subtitle="Live numbers from admin_overview(). Central time." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Overview />
      </Suspense>
    </main>
  );
}
