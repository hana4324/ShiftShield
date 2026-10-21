import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cancelPayment, resolveDispute, runSettlement } from "@/app/actions/admin-ops";
import { ActionForm } from "@/components/admin/action-form";
import { GpsTrail } from "@/components/admin/gps-trail";
import { Card, ErrorPanel, Facts, inputClasses, NotConfigured, PageHeader, Skeleton, StatusPill } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDateTime, fmtMinutes, fmtMoney, minutesBetween } from "@/lib/admin/format";
import { attempt, fetchDisputeDetail, isUuid } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Dispute" };

type Params = Promise<{ id: string }>;

async function Detail({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="this dispute" />;
  const res = await attempt(() => fetchDisputeDetail(admin.db, id));
  if (!res.ok) return <ErrorPanel message={`Could not load dispute: ${res.error}`} />;
  if (!res.data) notFound();
  const { dispute, assignment, shift, site, company, officer, openedBy, resolver, payment, pings } = res.data;
  const scheduled = shift ? minutesBetween(shift.start_at, shift.end_at) : null;
  const worked = assignment?.clock_in_at && assignment?.clock_out_at ? minutesBetween(assignment.clock_in_at, assignment.clock_out_at) : null;
  const open = dispute.status === "open";
  const openedByRole = assignment && openedBy ? (openedBy.id === assignment.officer_id ? "officer" : "employer") : "unknown";

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold tracking-tight">{shift?.title ?? "Dispute"}</h2>
        <StatusPill status={dispute.status} />
        <span className="text-sm text-navy-950/60">Opened {fmtDateTime(dispute.created_at)} by {openedBy?.full_name ?? "unknown"} ({openedByRole})</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card title="Both sides">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold tracking-wider text-steel-400 uppercase">Employer {company ? `(${company.name})` : ""}</p>
                <p className="mt-2 text-sm whitespace-pre-wrap">{dispute.employer_notes ?? <span className="text-navy-950/50">No employer notes.</span>}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold tracking-wider text-steel-400 uppercase">Officer {officer ? `(${officer.full_name})` : ""}</p>
                <p className="mt-2 text-sm whitespace-pre-wrap">{dispute.officer_notes ?? <span className="text-navy-950/50">No officer notes.</span>}</p>
              </div>
            </div>
            <p className="mt-4 text-sm">
              <span className="font-semibold">Reason:</span> {dispute.reason}
            </p>
            {assignment?.clock_out_notes ? (
              <p className="mt-2 text-sm">
                <span className="font-semibold">Clock-out notes:</span> {assignment.clock_out_notes}
              </p>
            ) : null}
          </Card>

          <Card title="Timesheet">
            <Facts
              columns={4}
              items={[
                { label: "Scheduled", value: shift ? `${fmtDateTime(shift.start_at)} to ${fmtDateTime(shift.end_at)}` : "-" },
                { label: "Scheduled minutes", value: fmtMinutes(scheduled) },
                { label: "Clock in", value: `${fmtDateTime(assignment?.clock_in_at)}${assignment?.clock_in_override ? " (override)" : ""}` },
                { label: "Clock out", value: fmtDateTime(assignment?.clock_out_at) },
                { label: "Worked (clock)", value: fmtMinutes(worked) },
                { label: "Currently approved", value: fmtMinutes(assignment?.approved_minutes) },
                { label: "Approval", value: assignment ? <StatusPill status={assignment.approval_status} /> : "-" },
                { label: "Rate", value: shift ? `${fmtMoney(shift.hourly_rate_cents)}/hr` : "-" },
              ]}
            />
          </Card>

          <Card title="GPS record">
            <GpsTrail
              pings={pings}
              site={site ? { geo: site.geo, radiusM: site.geofence_radius_m, name: site.name } : null}
              clockIn={assignment?.clock_in_geo}
              clockOut={assignment?.clock_out_geo}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={open ? "Resolve" : "Resolution"}>
            {!open ? (
              <div className="space-y-2 text-sm">
                <p>
                  <StatusPill status={dispute.status} /> {fmtDateTime(dispute.resolved_at)}
                  {resolver ? ` by ${resolver.full_name || resolver.email}` : ""}
                </p>
                <p>
                  <span className="font-semibold">Approved minutes:</span> {fmtMinutes(dispute.resolved_minutes)}
                </p>
                {dispute.resolution_notes ? <p className="rounded-xl bg-slate-50 p-3">{dispute.resolution_notes}</p> : null}
              </div>
            ) : null}
            {assignment ? (
              <details open={open} className={open ? "" : "mt-3"}>
                {!open ? <summary className="cursor-pointer text-sm font-semibold text-blue-700">Re-resolve with different minutes</summary> : null}
                <div className={open ? "" : "mt-3"}>
                  <ActionForm action={resolveDispute} submitLabel="Resolve dispute" confirm="Resolve with these minutes? Both parties are notified.">
                    <input type="hidden" name="assignment_id" value={assignment.id} />
                    <input type="hidden" name="dispute_id" value={dispute.id} />
                    <label htmlFor="minutes" className="block text-sm font-semibold">
                      Approved minutes <span className="font-normal text-steel-400">(0 = full refund; capped at scheduled)</span>
                    </label>
                    <input
                      id="minutes"
                      name="minutes"
                      type="number"
                      min={0}
                      max={1440}
                      step={1}
                      required
                      defaultValue={assignment.approved_minutes ?? worked ?? scheduled ?? 0}
                      className={`${inputClasses} w-full`}
                    />
                    <label htmlFor="notes" className="block text-sm font-semibold">
                      Resolution notes
                    </label>
                    <textarea id="notes" name="notes" rows={3} maxLength={1000} className="w-full rounded-xl border border-navy-950/15 px-3 py-2 text-sm focus-ring" />
                  </ActionForm>
                </div>
              </details>
            ) : (
              <p className="text-sm text-status-red">Assignment missing; cannot resolve.</p>
            )}
          </Card>

          {assignment ? (
            <Card title="Settlement">
              <p className="text-sm text-navy-950/70">
                After resolving, run the settlement: it calls the <code className="font-mono text-xs">approve-timesheet</code> Edge Function with your admin token to capture the approved amount, transfer the officer&apos;s pay and refund the rest.
              </p>
              <div className="mt-3">
                <ActionForm action={runSettlement} submitLabel="Run settlement" pendingLabel="Calling approve-timesheet..." variant={open ? "white" : "primary"} confirm="Run the settlement now? This moves money in Stripe.">
                  <input type="hidden" name="assignment_id" value={assignment.id} />
                  <input type="hidden" name="dispute_id" value={dispute.id} />
                </ActionForm>
              </div>
              <div className="mt-4 border-t border-navy-950/10 pt-4">
                <p className="text-xs font-semibold tracking-wider text-steel-400 uppercase">Payment</p>
                {payment ? (
                  <>
                    <p className="mt-1 text-sm">
                      <StatusPill status={payment.status} /> {fmtMoney(payment.total_cents)} total ({fmtMoney(payment.officer_pay_cents)} pay + {fmtMoney(payment.platform_fee_cents)} fee)
                      {payment.refunded_cents > 0 ? `, ${fmtMoney(payment.refunded_cents)} refunded` : ""}
                    </p>
                    {["pending", "authorized", "failed"].includes(payment.status) ? (
                      <div className="mt-3">
                        <p className="text-xs text-navy-950/60">
                          Issue refund = mark the payment canceled; the reconcile-payments job releases/refunds the Stripe authorization. Use when no money should move at all.
                        </p>
                        <div className="mt-2">
                          <ActionForm action={cancelPayment} submitLabel="Issue refund (cancel payment)" variant="white" confirm="Cancel this payment entirely?" inline>
                            <input type="hidden" name="payment_id" value={payment.id} />
                            <input type="hidden" name="dispute_id" value={dispute.id} />
                          </ActionForm>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-navy-950/60">No payment row for this assignment.</p>
                )}
              </div>
            </Card>
          ) : null}

          <Card title="Links">
            <ul className="space-y-1 text-sm">
              {shift ? (
                <li>
                  <Link href={`/admin/shifts/${shift.id}`} className="text-blue-700 hover:underline">
                    Shift: {shift.title}
                  </Link>
                </li>
              ) : null}
              {assignment ? (
                <li>
                  <Link href={`/admin/officers/${assignment.officer_id}`} className="text-blue-700 hover:underline">
                    Officer: {officer?.full_name ?? assignment.officer_id.slice(0, 8)}
                  </Link>
                </li>
              ) : null}
              {company ? (
                <li>
                  <Link href={`/admin/companies/${company.id}`} className="text-blue-700 hover:underline">
                    Company: {company.name}
                  </Link>
                </li>
              ) : null}
              <li>
                <Link href={`/admin/audit?entity=assignment&entity_id=${assignment?.id ?? ""}`} className="text-blue-700 hover:underline">
                  Audit trail for this assignment
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function DisputeDetailPage({ params }: { params: Params }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Dispute" back={{ href: "/admin/disputes", label: "Disputes" }} />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
