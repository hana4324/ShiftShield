import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { ShiftStatus } from "@shiftshield/shared";
import { Empty, ErrorPanel, FilterBar, inputClasses, NotConfigured, PageHeader, Pill, Skeleton, StatusPill, Table, Td } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDateTime, fmtMoney, minutesBetween, fmtMinutes } from "@/lib/admin/format";
import { attempt, fetchShifts } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Shifts" };

const STATUSES: ShiftStatus[] = ["draft", "open", "filled", "in_progress", "completed", "cancelled"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
type SP = Promise<{ q?: string; status?: string; from?: string; to?: string }>;

async function List({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80).trim();
  const status = STATUSES.find((s) => s === sp.status);
  const from = sp.from && DATE.test(sp.from) ? sp.from : undefined;
  const to = sp.to && DATE.test(sp.to) ? sp.to : undefined;
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="shifts" />;
  const res = await attempt(() => fetchShifts(admin.db, { q: q || undefined, status, from, to }));
  if (!res.ok) return <ErrorPanel message={`Could not load shifts: ${res.error}`} />;
  return (
    <>
      <FilterBar>
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Title or shift id" className={`${inputClasses} w-full`} />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className={inputClasses}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="block text-xs font-semibold text-steel-400">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={from ?? ""} className={inputClasses} />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-semibold text-steel-400">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={to ?? ""} className={inputClasses} />
        </div>
        <button type="submit" className={buttonClasses("white", "md")}>
          Filter
        </button>
      </FilterBar>
      {res.data.length === 0 ? (
        <Empty title="No shifts match" />
      ) : (
        <Table className="mt-4" head={["Shift", "Company / site", "Start", "Length", "Rate", "Booked", "Status"]}>
          {res.data.map(({ shift, company, site, booked }) => (
            <tr key={shift.id} className="hover:bg-slate-50">
              <Td>
                <Link href={`/admin/shifts/${shift.id}`} className="font-semibold text-blue-700 hover:underline">
                  {shift.title}
                </Link>
                {shift.is_urgent ? (
                  <span className="ml-2">
                    <Pill tone="amber">urgent</Pill>
                  </span>
                ) : null}
                <div className="text-xs text-navy-950/60">
                  L{shift.required_license_level}
                  {shift.armed_required ? " armed" : ""} / {shift.fill_mode}
                </div>
              </Td>
              <Td>
                {company ? (
                  <Link href={`/admin/companies/${company.id}`} className="hover:underline">
                    {company.name}
                  </Link>
                ) : (
                  "-"
                )}
                <div className="text-xs text-navy-950/60">{site?.name ?? ""}</div>
              </Td>
              <Td className="text-navy-950/70">{fmtDateTime(shift.start_at)}</Td>
              <Td>{fmtMinutes(minutesBetween(shift.start_at, shift.end_at))}</Td>
              <Td className="tabular-nums">{fmtMoney(shift.hourly_rate_cents)}/hr</Td>
              <Td className="tabular-nums">
                {booked} / {shift.officers_needed}
              </Td>
              <Td>
                <StatusPill status={shift.status} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

export default function ShiftsPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Shifts" subtitle="All shifts across companies. Dates are Central time." />
      <Suspense fallback={<Skeleton rows={5} />}>
        <List searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
