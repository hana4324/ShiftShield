import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cancelPayment } from "@/app/actions/admin-ops";
import { ActionForm } from "@/components/admin/action-form";
import { GpsTrail } from "@/components/admin/gps-trail";
import { Card, ErrorPanel, Facts, NotConfigured, PageHeader, Pill, Skeleton, StatusPill, Table, Td } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDateTime, fmtMinutes, fmtMoney, minutesBetween, titleCase } from "@/lib/admin/format";
import { attempt, fetchShiftDetail, isUuid, type AssignmentDetail } from "@/lib/admin/queries";
import type { SiteRow } from "@shiftshield/shared";

export const metadata: Metadata = { title: "Shift" };

type Params = Promise<{ id: string }>;

function AssignmentCard({ a, site, shiftId }: { a: AssignmentDetail; site: SiteRow | null; shiftId: string }) {
  const { assignment, profile, payment, dispute, pings } = a;
  const worked = assignment.clock_in_at && assignment.clock_out_at ? minutesBetween(assignment.clock_in_at, assignment.clock_out_at) : null;
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/officers/${assignment.officer_id}`} className="text-blue-700 hover:underline">
            {profile?.full_name || "Unnamed officer"}
          </Link>
          <StatusPill status={assignment.status} />
          <StatusPill status={assignment.approval_status} />
          {dispute ? (
            <Link href={`/admin/disputes/${dispute.id}`}>
              <Pill tone={dispute.status === "open" ? "red" : "gray"}>dispute {dispute.status.replace(/_/g, " ")}</Pill>
            </Link>
          ) : null}
        </span>
      }
    >
      <Facts
        columns={4}
        items={[
          { label: "Clock in", value: `${fmtDateTime(assignment.clock_in_at)}${assignment.clock_in_override ? " (override)" : ""}` },
          { label: "Clock out", value: fmtDateTime(assignment.clock_out_at) },
          { label: "Worked", value: fmtMinutes(worked) },
          { label: "Approved minutes", value: fmtMinutes(assignment.approved_minutes) },
          { label: "Approved at", value: fmtDateTime(assignment.approved_at) },
          { label: "Accuracy in / out", value: `${assignment.clock_in_accuracy_m ?? "-"} / ${assignment.clock_out_accuracy_m ?? "-"} m` },
          { label: "Payment", value: payment ? <StatusPill status={payment.status} /> : "none" },
          { label: "Amounts", value: payment ? `${fmtMoney(payment.total_cents)} total / ${fmtMoney(payment.officer_pay_cents)} pay / ${fmtMoney(payment.platform_fee_cents)} fee` : "-" },
        ]}
      />
      {assignment.clock_out_notes ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <span className="font-semibold">Officer notes:</span> {assignment.clock_out_notes}
        </p>
      ) : null}
      {assignment.cancel_reason ? (
        <p className="mt-3 text-sm text-navy-950/70">
          <span className="font-semibold">Cancelled:</span> {fmtDateTime(assignment.cancelled_at)} / {assignment.cancel_reason}
        </p>
      ) : null}
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold tracking-wider text-steel-400 uppercase">GPS trail</p>
        <GpsTrail
          pings={pings}
          site={site ? { geo: site.geo, radiusM: site.geofence_radius_m, name: site.name } : null}
          clockIn={assignment.clock_in_geo}
          clockOut={assignment.clock_out_geo}
        />
      </div>
      {payment && ["pending", "authorized", "failed"].includes(payment.status) ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="text-sm text-navy-950/70">
            Issue refund: marks the payment <code className="font-mono text-xs">canceled</code>; the reconcile-payments job then releases or refunds the Stripe authorization. Use this when no money should move for this booking.
          </p>
          <div className="mt-2">
            <ActionForm action={cancelPayment} submitLabel="Issue refund (cancel payment)" variant="white" confirm="Cancel this payment? The reconcile job will refund the authorization." inline>
              <input type="hidden" name="payment_id" value={payment.id} />
              <input type="hidden" name="shift_id" value={shiftId} />
            </ActionForm>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

async function Detail({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="this shift" />;
  const res = await attempt(() => fetchShiftDetail(admin.db, id));
  if (!res.ok) return <ErrorPanel message={`Could not load shift: ${res.error}`} />;
  if (!res.data) notFound();
  const { shift, company, site, cost, costError, applications, assignments } = res.data;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold tracking-tight">{shift.title}</h2>
        <StatusPill status={shift.status} />
        {shift.is_urgent ? <Pill tone="amber">urgent</Pill> : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card title="Shift">
            <Facts
              columns={3}
              items={[
                { label: "Company", value: company ? <Link href={`/admin/companies/${company.id}`} className="text-blue-700 hover:underline">{company.name}</Link> : "-" },
                { label: "Site", value: site ? `${site.name} (${titleCase(site.site_type)})` : "-" },
                { label: "Address", value: site?.address ?? "-" },
                { label: "Start", value: fmtDateTime(shift.start_at) },
                { label: "End", value: fmtDateTime(shift.end_at) },
                { label: "Length", value: fmtMinutes(minutesBetween(shift.start_at, shift.end_at)) },
                { label: "Rate", value: `${fmtMoney(shift.hourly_rate_cents)}/hr` },
                { label: "Officers needed", value: shift.officers_needed },
                { label: "Requirement", value: `Level ${shift.required_license_level}${shift.armed_required ? ", armed" : ""}` },
                { label: "Fill mode", value: shift.fill_mode },
                { label: "Published", value: fmtDateTime(shift.published_at) },
                { label: "Cancelled", value: shift.cancelled_at ? `${fmtDateTime(shift.cancelled_at)} / ${shift.cancel_reason ?? ""}` : "-" },
                { label: "Geofence", value: site ? `${site.geofence_radius_m} m` : "-" },
                { label: "Shift id", value: <code className="font-mono text-xs">{shift.id}</code> },
              ]}
            />
            {shift.description ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{shift.description}</p> : null}
            {shift.requirements.length > 0 ? (
              <p className="mt-3 text-sm text-navy-950/70">Requirements: {shift.requirements.map((r) => r.label).join(", ")}</p>
            ) : null}
          </Card>

          <Card title={`Assignments (${assignments.length})`}>
            {assignments.length === 0 ? <p className="text-sm text-navy-950/60">Nobody booked yet.</p> : null}
          </Card>
          {assignments.map((a) => (
            <AssignmentCard key={a.assignment.id} a={a} site={site} shiftId={shift.id} />
          ))}
        </div>

        <div className="space-y-4">
          <Card title="Cost (shift_cost)">
            {cost ? (
              <Facts
                columns={1}
                items={[
                  { label: "Per officer pay", value: fmtMoney(cost.officer_pay_cents) },
                  { label: "Platform fee", value: `${fmtMoney(cost.platform_fee_cents)} (${(cost.fee_bps / 100).toFixed(2)}%)` },
                  { label: "Per officer total", value: fmtMoney(cost.per_officer_total_cents) },
                  { label: "Officers", value: cost.officers_needed },
                  { label: "Total", value: <span className="text-lg">{fmtMoney(cost.total_cents)}</span> },
                ]}
              />
            ) : (
              <p className="text-sm text-navy-950/60">{costError ?? "Unavailable"}</p>
            )}
          </Card>

          <Card title={`Applications (${applications.length})`}>
            {applications.length === 0 ? (
              <p className="text-sm text-navy-950/60">None.</p>
            ) : (
              <Table head={["Officer", "Status", "Applied"]}>
                {applications.map(({ application, profile }) => (
                  <tr key={application.id}>
                    <Td>
                      <Link href={`/admin/officers/${application.officer_id}`} className="text-blue-700 hover:underline">
                        {profile?.full_name || "Unnamed"}
                      </Link>
                      {application.message ? <div className="text-xs text-navy-950/60">{application.message}</div> : null}
                    </Td>
                    <Td>
                      <StatusPill status={application.status} />
                    </Td>
                    <Td className="text-navy-950/70">{fmtDateTime(application.created_at)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function ShiftDetailPage({ params }: { params: Params }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Shift" back={{ href: "/admin/shifts", label: "Shifts" }} />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
