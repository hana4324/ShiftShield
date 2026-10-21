import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { OfficerAccountStatus } from "@shiftshield/shared";
import {
  Empty,
  ErrorPanel,
  FilterBar,
  inputClasses,
  NotConfigured,
  PageHeader,
  Skeleton,
  StatusPill,
  Table,
  Td,
} from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDateTime } from "@/lib/admin/format";
import { attempt, fetchOfficers } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Officers" };

const STATUSES: OfficerAccountStatus[] = ["onboarding", "active", "suspended", "deactivated"];
type SP = Promise<{ q?: string; status?: string }>;

async function List({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80).trim();
  const status = STATUSES.find((s) => s === sp.status);
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="officers" />;
  const res = await attempt(() => fetchOfficers(admin.db, { q: q || undefined, status }));
  if (!res.ok) return <ErrorPanel message={`Could not load officers: ${res.error}`} />;
  return (
    <>
      <FilterBar>
        <div className="min-w-64 flex-1">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, email or phone" className={`${inputClasses} w-full`} />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Account status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className={inputClasses}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClasses("white", "md")}>
          Filter
        </button>
      </FilterBar>
      {res.data.length === 0 ? (
        <Empty title="No officers match" hint="Officers appear once they sign up in the app." />
      ) : (
        <Table className="mt-4" head={["Officer", "Contact", "Status", "Fee", "Background", "Rating", "Shifts", "Joined"]}>
          {res.data.map(({ officer, profile }) => (
            <tr key={officer.user_id} className="hover:bg-slate-50">
              <Td>
                <Link href={`/admin/officers/${officer.user_id}`} className="font-semibold text-blue-700 hover:underline">
                  {profile?.full_name || "Unnamed"}
                </Link>
                <div className="text-xs text-navy-950/60">{officer.home_city ?? ""}</div>
              </Td>
              <Td className="text-navy-950/70">
                <div>{profile?.email ?? "-"}</div>
                <div>{profile?.phone ?? "-"}</div>
              </Td>
              <Td>
                <StatusPill status={officer.account_status} />
              </Td>
              <Td>{officer.signup_fee_paid_at ? "Paid" : <span className="text-status-red">Unpaid</span>}</Td>
              <Td>
                <StatusPill status={officer.background_status} />
              </Td>
              <Td className="tabular-nums">
                {officer.rating_count > 0 ? `${Number(officer.rating_avg).toFixed(2)} (${officer.rating_count})` : "-"}
              </Td>
              <Td className="tabular-nums">
                {officer.completed_shifts}
                {officer.no_show_count > 0 ? <span className="ml-1 text-xs text-status-red">{officer.no_show_count} no-show</span> : null}
              </Td>
              <Td className="text-navy-950/70">{fmtDateTime(officer.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

export default function OfficersPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Officers" subtitle="Search by name, email or phone. Newest first, 200 max." />
      <Suspense fallback={<Skeleton rows={5} />}>
        <List searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
