import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Empty, ErrorPanel, NotConfigured, PageHeader, Skeleton, StatusPill, Table, Tabs, Td } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDateTime, fmtMinutes } from "@/lib/admin/format";
import { attempt, fetchDisputes } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Disputes" };

type SP = Promise<{ status?: string }>;
const TABS = ["open", "resolved", "all"] as const;

async function Queue({ searchParams }: { searchParams: SP }) {
  const { status: raw } = await searchParams;
  const status = TABS.find((t) => t === raw) ?? "open";
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="disputes" />;
  const res = await attempt(() => fetchDisputes(admin.db, status));
  if (!res.ok) return <ErrorPanel message={`Could not load disputes: ${res.error}`} />;
  return (
    <>
      <Tabs
        current={status}
        items={TABS.map((t) => ({ value: t, label: t === "open" ? "Open" : t === "resolved" ? "Resolved" : "All", href: t === "open" ? "/admin/disputes" : `/admin/disputes?status=${t}` }))}
      />
      {res.data.length === 0 ? (
        <Empty title={status === "open" ? "No open disputes" : "No disputes"} hint="Disputed timesheets from employers or officers land here." />
      ) : (
        <Table className="mt-4" head={["Opened", "Shift", "Officer", "Company", "Opened by", "Reason", "Status", "Minutes"]}>
          {res.data.map(({ dispute, assignment, shift, company, officer, openedBy }) => (
            <tr key={dispute.id} className="hover:bg-slate-50">
              <Td className="text-navy-950/70">
                <Link href={`/admin/disputes/${dispute.id}`} className="font-semibold text-blue-700 hover:underline">
                  {fmtDateTime(dispute.created_at)}
                </Link>
              </Td>
              <Td>
                {shift ? (
                  <Link href={`/admin/shifts/${shift.id}`} className="hover:underline">
                    {shift.title}
                  </Link>
                ) : (
                  "-"
                )}
                <div className="text-xs text-navy-950/60">{shift ? fmtDateTime(shift.start_at) : ""}</div>
              </Td>
              <Td>{officer?.full_name ?? assignment?.officer_id.slice(0, 8) ?? "-"}</Td>
              <Td>{company?.name ?? "-"}</Td>
              <Td>{openedBy?.full_name ?? "-"}</Td>
              <Td className="max-w-xs truncate text-navy-950/70" title={dispute.reason}>
                {dispute.reason}
              </Td>
              <Td>
                <StatusPill status={dispute.status} />
              </Td>
              <Td className="tabular-nums">{dispute.resolved_minutes !== null ? fmtMinutes(dispute.resolved_minutes) : "-"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

export default function DisputesPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Disputes" subtitle="Timesheet disputes. Resolve with a final minute count, then run the settlement." />
      <Suspense fallback={<Skeleton rows={5} />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
