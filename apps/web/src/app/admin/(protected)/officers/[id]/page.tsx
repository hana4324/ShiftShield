import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BLOCKER_TEXT } from "@shiftshield/shared";
import { setBackgroundStatus, setOfficerStatus } from "@/app/actions/admin-ops";
import { ActionForm } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { Card, ErrorPanel, Facts, inputClasses, NotConfigured, PageHeader, Pill, Skeleton, StatusPill, Table, Td } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDate, fmtDateTime, fmtMinutes, fmtMoney, titleCase } from "@/lib/admin/format";
import { attempt, fetchOfficerDetail, isUuid } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Officer" };

type Params = Promise<{ id: string }>;

async function Detail({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="this officer" />;
  const res = await attempt(() => fetchOfficerDetail(admin.db, id));
  if (!res.ok) return <ErrorPanel message={`Could not load officer: ${res.error}`} />;
  if (!res.data) notFound();
  const { officer, profile, licenses, certifications, strikes, ratings, assignments, payments, blockers } = res.data;
  const name = profile?.full_name || "Unnamed officer";

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold tracking-tight">{name}</h2>
        <StatusPill status={officer.account_status} />
        {officer.is_available ? <Pill tone="green">available</Pill> : <Pill tone="gray">unavailable</Pill>}
        {blockers.length > 0 ? (
          <span className="text-sm text-navy-950/70">
            Blocked from accepting shifts: {blockers.map((b) => BLOCKER_TEXT[b] ?? b).join("; ")}
          </span>
        ) : (
          <span className="text-sm text-status-green-700">Eligible to accept shifts</span>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card title="Profile">
            <Facts
              columns={3}
              items={[
                { label: "Email", value: profile?.email ? <a className="text-blue-700 hover:underline" href={`mailto:${profile.email}`}>{profile.email}</a> : "-" },
                { label: "Phone", value: profile?.phone ? <a className="text-blue-700 hover:underline" href={`tel:${profile.phone}`}>{profile.phone}</a> : "-" },
                { label: "Home", value: [officer.home_city, officer.home_zip].filter(Boolean).join(" ") || "-" },
                { label: "Travel radius", value: `${officer.travel_radius_mi} mi` },
                { label: "Age gates", value: `${officer.is_18_plus ? "18+" : "under 18?"}${officer.is_21_plus ? ", 21+" : ""}` },
                { label: "Joined", value: fmtDateTime(officer.created_at) },
                { label: "Signup fee", value: officer.signup_fee_paid_at ? `Paid ${fmtDateTime(officer.signup_fee_paid_at)}` : "Not paid" },
                {
                  label: "Background",
                  value: (
                    <>
                      <StatusPill status={officer.background_status} />
                      <span className="ml-2 text-xs font-normal text-navy-950/60">
                        {officer.background_provider ?? ""} {officer.background_reference ?? ""}
                      </span>
                    </>
                  ),
                },
                { label: "Rating", value: officer.rating_count > 0 ? `${Number(officer.rating_avg).toFixed(2)} / 5 (${officer.rating_count})` : "No ratings yet" },
                { label: "Completed shifts", value: officer.completed_shifts },
                { label: "No-shows / late cancels", value: `${officer.no_show_count} / ${officer.late_cancel_count}` },
                { label: "Status reason", value: officer.status_reason ?? "-" },
                {
                  label: "Stripe account",
                  value: officer.stripe_account_id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-xs">{officer.stripe_account_id}</code>
                      <CopyButton value={officer.stripe_account_id} label="Copy id" />
                    </span>
                  ) : (
                    "Not connected"
                  ),
                },
                { label: "Payouts", value: `${officer.payouts_enabled ? "enabled" : "disabled"}${officer.instant_payouts_enabled ? ", instant" : ""}` },
                { label: "User id", value: <code className="font-mono text-xs">{officer.user_id}</code> },
              ]}
            />
          </Card>

          <Card title="Licenses">
            {licenses.length === 0 ? (
              <p className="text-sm text-navy-950/60">No licenses uploaded.</p>
            ) : (
              <ul className="divide-y divide-navy-950/5 text-sm">
                {licenses.map(({ license, type }) => (
                  <li key={license.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <Link href={`/admin/licenses/${license.id}`} className="font-semibold text-blue-700 hover:underline">
                        {type?.name ?? "License"}
                      </Link>{" "}
                      <span className="font-mono text-xs">{license.license_number}</span>
                      <span className="text-navy-950/60"> / expires {fmtDate(license.expires_on)}</span>
                    </span>
                    <StatusPill status={license.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Certifications">
            {certifications.length === 0 ? (
              <p className="text-sm text-navy-950/60">None.</p>
            ) : (
              <ul className="divide-y divide-navy-950/5 text-sm">
                {certifications.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2 py-2">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-navy-950/60">
                      {c.issued_on ? `issued ${fmtDate(c.issued_on)}` : ""}
                      {c.expires_on ? ` / expires ${fmtDate(c.expires_on)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent assignments">
            {assignments.length === 0 ? (
              <p className="text-sm text-navy-950/60">No bookings yet.</p>
            ) : (
              <Table head={["Shift", "Company", "Status", "Clock in / out", "Approved", "Approval"]}>
                {assignments.map(({ assignment: a, shift, company }) => (
                  <tr key={a.id}>
                    <Td>
                      {shift ? (
                        <Link href={`/admin/shifts/${shift.id}`} className="font-semibold text-blue-700 hover:underline">
                          {shift.title}
                        </Link>
                      ) : (
                        a.shift_id.slice(0, 8)
                      )}
                      <div className="text-xs text-navy-950/60">{shift ? fmtDateTime(shift.start_at) : ""}</div>
                    </Td>
                    <Td>{company ? <Link href={`/admin/companies/${company.id}`} className="hover:underline">{company.name}</Link> : "-"}</Td>
                    <Td>
                      <StatusPill status={a.status} />
                    </Td>
                    <Td className="text-navy-950/70">
                      {fmtDateTime(a.clock_in_at)} / {fmtDateTime(a.clock_out_at)}
                    </Td>
                    <Td>{fmtMinutes(a.approved_minutes)}</Td>
                    <Td>
                      <StatusPill status={a.approval_status} />
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="Payments">
            {payments.length === 0 ? (
              <p className="text-sm text-navy-950/60">No payments yet.</p>
            ) : (
              <Table head={["Created", "Officer pay", "Fee", "Total", "Status", "Paid out", "Stripe"]}>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="text-navy-950/70">{fmtDateTime(p.created_at)}</Td>
                    <Td className="tabular-nums">{fmtMoney(p.officer_pay_cents)}</Td>
                    <Td className="tabular-nums">{fmtMoney(p.platform_fee_cents)}</Td>
                    <Td className="tabular-nums">{fmtMoney(p.total_cents)}</Td>
                    <Td>
                      <StatusPill status={p.status} />
                    </Td>
                    <Td className="tabular-nums">{fmtMoney(p.paid_out_cents)}</Td>
                    <Td className="font-mono text-xs">{p.stripe_transfer_id ?? p.stripe_payment_intent_id ?? "-"}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Account status">
            <ActionForm action={setOfficerStatus} submitLabel="Apply status" confirm="Change this officer's account status? They will be notified.">
              <input type="hidden" name="id" value={officer.user_id} />
              <label htmlFor="status" className="block text-sm font-semibold">
                New status
              </label>
              <select id="status" name="status" defaultValue={officer.account_status} className={`${inputClasses} w-full`}>
                <option value="active">Active (reinstate)</option>
                <option value="suspended">Suspended</option>
                <option value="deactivated">Deactivated</option>
                <option value="onboarding">Onboarding</option>
              </select>
              <label htmlFor="reason" className="block text-sm font-semibold">
                Reason <span className="font-normal text-steel-400">(sent to the officer, logged)</span>
              </label>
              <textarea id="reason" name="reason" rows={3} maxLength={500} className="w-full rounded-xl border border-navy-950/15 px-3 py-2 text-sm focus-ring" />
            </ActionForm>
          </Card>

          <Card title="Background check">
            <ActionForm action={setBackgroundStatus} submitLabel="Set background status" confirm="Override the background check status?">
              <input type="hidden" name="id" value={officer.user_id} />
              <label htmlFor="bg-status" className="block text-sm font-semibold">
                Status
              </label>
              <select id="bg-status" name="status" defaultValue={officer.background_status} className={`${inputClasses} w-full`}>
                {["not_started", "pending", "clear", "consider", "failed"].map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </select>
              <label htmlFor="reference" className="block text-sm font-semibold">
                Reference <span className="font-normal text-steel-400">(provider id, optional)</span>
              </label>
              <input id="reference" name="reference" defaultValue={officer.background_reference ?? ""} maxLength={200} className={`${inputClasses} w-full`} />
              <p className="text-xs text-navy-950/60">Provider is recorded as &quot;manual&quot;. Clearing it activates the officer once the fee is paid and a license is approved.</p>
            </ActionForm>
          </Card>

          <Card title="Strikes">
            {strikes.length === 0 ? (
              <p className="text-sm text-navy-950/60">None.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {strikes.map((s) => (
                  <li key={s.id}>
                    <StatusPill status={s.type} /> <span className="text-navy-950/70">{fmtDateTime(s.created_at)}</span>
                    {s.notes ? <div className="text-navy-950/70">{s.notes}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Employer ratings">
            {ratings.length === 0 ? (
              <p className="text-sm text-navy-950/60">None yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {ratings.map(({ rating, rater }) => (
                  <li key={rating.id}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{"*".repeat(rating.stars)} {rating.stars}/5</span>
                      <span className="text-xs text-navy-950/60">{fmtDateTime(rating.created_at)}</span>
                    </div>
                    <div className="text-xs text-navy-950/60">{rater?.full_name ?? "Employer"}{rating.tags.length ? ` / ${rating.tags.join(", ")}` : ""}</div>
                    {rating.comment ? <p className="mt-1 text-navy-950/80">{rating.comment}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function OfficerDetailPage({ params }: { params: Params }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Officer" back={{ href: "/admin/officers", label: "Officers" }} />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
