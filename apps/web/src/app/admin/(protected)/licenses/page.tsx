import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { LicenseStatus } from "@shiftshield/shared";
import {
  Empty,
  ErrorPanel,
  NotConfigured,
  PageHeader,
  Skeleton,
  StatusPill,
  Table,
  Tabs,
  Td,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDate, fmtDateTime } from "@/lib/admin/format";
import { attempt, fetchLicenseCounts, fetchLicenses } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "License review" };

const TABS: Array<{ value: LicenseStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "suspended", label: "Suspended" },
  { value: "all", label: "All" },
];

type SP = Promise<{ status?: string }>;

async function Queue({ searchParams }: { searchParams: SP }) {
  const { status: raw } = await searchParams;
  const status = (TABS.find((t) => t.value === raw)?.value ?? "pending") as LicenseStatus | "all";
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="the license queue" />;
  const [list, counts] = await Promise.all([
    attempt(() => fetchLicenses(admin.db, status)),
    attempt(() => fetchLicenseCounts(admin.db)),
  ]);
  if (!list.ok) return <ErrorPanel message={`Could not load licenses: ${list.error}`} />;
  const c = counts.ok ? counts.data : {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Tabs
        current={status}
        items={TABS.map((t) => ({
          ...t,
          href: t.value === "pending" ? "/admin/licenses" : `/admin/licenses?status=${t.value}`,
          count: t.value === "all" ? null : (c[t.value] ?? 0),
        }))}
      />
      {list.data.length === 0 ? (
        <Empty
          title={status === "pending" ? "No licenses waiting" : `No ${status} licenses`}
          hint={status === "pending" ? "New uploads from the officer app land here." : undefined}
        />
      ) : (
        <Table
          className="mt-4"
          head={["Officer", "Contact", "License", "Number", "Expires", "Submitted", "Status", ""]}
        >
          {list.data.map(({ license, type, profile }) => {
            const expired = license.expires_on < today;
            return (
              <tr key={license.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/admin/licenses/${license.id}`} className="font-semibold text-blue-700 hover:underline">
                    {profile?.full_name || "Unknown officer"}
                  </Link>
                </Td>
                <Td className="text-navy-950/70">
                  <div>{profile?.email ?? "-"}</div>
                  <div>{profile?.phone ?? "-"}</div>
                </Td>
                <Td>{type ? type.name : license.license_type_id.slice(0, 8)}</Td>
                <Td className="font-mono text-xs">{license.license_number}</Td>
                <Td className={expired ? "font-semibold text-status-red" : ""}>{fmtDate(license.expires_on)}</Td>
                <Td className="text-navy-950/70">{fmtDateTime(license.created_at)}</Td>
                <Td>
                  <StatusPill status={license.status} />
                </Td>
                <Td>
                  <Link href={`/admin/licenses/${license.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
                    Review
                  </Link>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}

export default function LicensesPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="License review"
        subtitle="Texas DPS licenses uploaded by officers. Oldest pending first; approving activates the officer once the fee is paid and the background check is clear."
      />
      <Suspense fallback={<Skeleton rows={5} />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
