import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { SubscriptionStatus } from "@shiftshield/shared";
import { Empty, ErrorPanel, FilterBar, inputClasses, NotConfigured, PageHeader, Pill, Skeleton, StatusPill, Table, Td } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDate, fmtDateTime, titleCase } from "@/lib/admin/format";
import { attempt, fetchCompanies } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Companies" };

const SUBS: SubscriptionStatus[] = ["none", "trialing", "active", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused"];
const PLANS = ["essential", "pro", "enterprise", "none"];
type SP = Promise<{ q?: string; plan?: string; sub?: string }>;

async function List({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80).trim();
  const plan = PLANS.find((p) => p === sp.plan);
  const subscription = SUBS.find((s) => s === sp.sub);
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="companies" />;
  const res = await attempt(() => fetchCompanies(admin.db, { q: q || undefined, plan, subscription }));
  if (!res.ok) return <ErrorPanel message={`Could not load companies: ${res.error}`} />;
  return (
    <>
      <FilterBar>
        <div className="min-w-64 flex-1">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Company, DBA, billing email or phone" className={`${inputClasses} w-full`} />
        </div>
        <div>
          <label htmlFor="plan" className="sr-only">
            Plan
          </label>
          <select id="plan" name="plan" defaultValue={plan ?? ""} className={inputClasses}>
            <option value="">All plans</option>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p === "none" ? "No plan" : titleCase(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sub" className="sr-only">
            Subscription status
          </label>
          <select id="sub" name="sub" defaultValue={subscription ?? ""} className={inputClasses}>
            <option value="">All subscription states</option>
            {SUBS.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClasses("white", "md")}>
          Filter
        </button>
      </FilterBar>
      {res.data.length === 0 ? (
        <Empty title="No companies match" hint="Employers appear once they create a company in the app." />
      ) : (
        <Table className="mt-4" head={["Company", "Type", "Plan", "Subscription", "Period ends", "Pilot", "Created"]}>
          {res.data.map(({ company, plan: p }) => (
            <tr key={company.id} className="hover:bg-slate-50">
              <Td>
                <Link href={`/admin/companies/${company.id}`} className="font-semibold text-blue-700 hover:underline">
                  {company.name}
                </Link>
                <div className="text-xs text-navy-950/60">{company.dba ? `dba ${company.dba} / ` : ""}{company.billing_email ?? ""}</div>
              </Td>
              <Td>{titleCase(company.type)}</Td>
              <Td>{p ? p.name : <span className="text-navy-950/50">None</span>}</Td>
              <Td>
                <StatusPill status={company.subscription_status} />
              </Td>
              <Td className="text-navy-950/70">{fmtDate(company.current_period_end)}</Td>
              <Td>{company.is_pilot ? <Pill tone="blue">pilot{company.pilot_ends_at ? ` to ${fmtDate(company.pilot_ends_at)}` : ""}</Pill> : "-"}</Td>
              <Td className="text-navy-950/70">{fmtDateTime(company.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

export default function CompaniesPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Companies" subtitle="Employers, their plan and subscription state." />
      <Suspense fallback={<Skeleton rows={5} />}>
        <List searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
