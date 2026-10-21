import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatCap, formatFeeBps, formatLeadTime } from "@shiftshield/shared";
import { setCompanyPilot, setCompanyPlan } from "@/app/actions/admin-ops";
import { ActionForm } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { Card, ErrorPanel, Facts, inputClasses, NotConfigured, PageHeader, Pill, Skeleton, StatusPill, Table, Td } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDate, fmtDateTime, fmtMoney, titleCase } from "@/lib/admin/format";
import { attempt, fetchCompanyDetail, isUuid } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Company" };

type Params = Promise<{ id: string }>;

function Usage({ used, cap }: { used: number; cap: number | null }) {
  const over = cap !== null && used >= cap;
  return (
    <span className={over ? "font-semibold text-status-red" : ""}>
      {used} / {formatCap(cap)}
    </span>
  );
}

async function Detail({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="this company" />;
  const res = await attempt(() => fetchCompanyDetail(admin.db, id));
  if (!res.ok) return <ErrorPanel message={`Could not load company: ${res.error}`} />;
  if (!res.data) notFound();
  const { company, plan, members, sites, usage, usageError, shifts, payments, plans } = res.data;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold tracking-tight">{company.name}</h2>
        <StatusPill status={company.subscription_status} />
        {company.is_pilot ? <Pill tone="blue">pilot</Pill> : null}
        <span className="text-sm text-navy-950/60">{titleCase(company.type)}</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card title="Company">
            <Facts
              columns={3}
              items={[
                { label: "DBA", value: company.dba ?? "-" },
                { label: "Phone", value: company.phone ?? "-" },
                { label: "Billing email", value: company.billing_email ?? "-" },
                { label: "DPS license no.", value: company.dps_license_no ?? "-" },
                { label: "Plan", value: plan ? `${plan.name} (${fmtMoney(plan.price_cents)}/mo)` : "None" },
                { label: "Period", value: company.current_period_start ? `${fmtDate(company.current_period_start)} to ${fmtDate(company.current_period_end)}` : "-" },
                { label: "Pilot ends", value: company.is_pilot ? fmtDate(company.pilot_ends_at) : "-" },
                {
                  label: "Stripe customer",
                  value: company.stripe_customer_id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-xs">{company.stripe_customer_id}</code>
                      <CopyButton value={company.stripe_customer_id} label="Copy" />
                    </span>
                  ) : (
                    "-"
                  ),
                },
                { label: "Stripe subscription", value: company.stripe_subscription_id ? <code className="font-mono text-xs">{company.stripe_subscription_id}</code> : "-" },
                { label: "Created", value: fmtDateTime(company.created_at) },
                { label: "Company id", value: <code className="font-mono text-xs">{company.id}</code> },
              ]}
            />
          </Card>

          <Card title="Usage this period">
            {usage ? (
              <Facts
                columns={4}
                items={[
                  { label: "Plan", value: usage.plan_name },
                  { label: "Period", value: `${fmtDate(usage.period_start)} to ${fmtDate(usage.period_end)}` },
                  { label: "Bookings", value: <Usage used={usage.bookings_used} cap={usage.booking_cap} /> },
                  { label: "Shifts posted", value: <Usage used={usage.shifts_used} cap={usage.shift_cap} /> },
                  { label: "Sites", value: <Usage used={usage.sites_used} cap={usage.site_cap} /> },
                  { label: "Seats", value: <Usage used={usage.seats_used} cap={usage.seat_cap} /> },
                  { label: "Lead time", value: formatLeadTime(usage.min_lead_time_minutes) },
                  { label: "Platform fee", value: `${formatFeeBps(usage.fee_bps)}${usage.daily_pay_enabled ? " / daily pay" : ""}` },
                ]}
              />
            ) : (
              <p className="text-sm text-navy-950/60">{usageError ? `company_usage: ${usageError}` : "No plan assigned, so no usage limits apply yet."}</p>
            )}
          </Card>

          <Card title={`Members (${members.length})`}>
            {members.length === 0 ? (
              <p className="text-sm text-navy-950/60">No members.</p>
            ) : (
              <ul className="divide-y divide-navy-950/5 text-sm">
                {members.map(({ member, profile }) => (
                  <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{profile?.full_name || "Unnamed"}</span>
                      <span className="text-navy-950/60"> {profile?.email ?? ""} {profile?.phone ? `/ ${profile.phone}` : ""}</span>
                    </span>
                    <Pill tone={member.role === "owner" ? "navy" : "gray"}>{member.role}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Sites (${sites.length})`}>
            {sites.length === 0 ? (
              <p className="text-sm text-navy-950/60">No sites yet.</p>
            ) : (
              <Table head={["Site", "Type", "Address", "Geofence", "Contact", "Active"]}>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-semibold">{s.name}</Td>
                    <Td>{titleCase(s.site_type)}</Td>
                    <Td className="text-navy-950/70">{s.address}</Td>
                    <Td className="tabular-nums">{s.geofence_radius_m} m</Td>
                    <Td className="text-navy-950/70">{[s.contact_name, s.contact_phone].filter(Boolean).join(" / ") || "-"}</Td>
                    <Td>{s.is_active ? "Yes" : "No"}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="Recent shifts">
            {shifts.length === 0 ? (
              <p className="text-sm text-navy-950/60">No shifts posted.</p>
            ) : (
              <Table head={["Shift", "Site", "Start", "Rate", "Officers", "Status"]}>
                {shifts.map(({ shift, site }) => (
                  <tr key={shift.id}>
                    <Td>
                      <Link href={`/admin/shifts/${shift.id}`} className="font-semibold text-blue-700 hover:underline">
                        {shift.title}
                      </Link>
                    </Td>
                    <Td>{site?.name ?? "-"}</Td>
                    <Td className="text-navy-950/70">{fmtDateTime(shift.start_at)}</Td>
                    <Td className="tabular-nums">{fmtMoney(shift.hourly_rate_cents)}/hr</Td>
                    <Td className="tabular-nums">{shift.officers_needed}</Td>
                    <Td>
                      <StatusPill status={shift.status} />
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="Recent payments">
            {payments.length === 0 ? (
              <p className="text-sm text-navy-950/60">No payments yet.</p>
            ) : (
              <Table head={["Created", "Total", "Officer pay", "Fee", "Status", "Refunded"]}>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="text-navy-950/70">{fmtDateTime(p.created_at)}</Td>
                    <Td className="tabular-nums">{fmtMoney(p.total_cents)}</Td>
                    <Td className="tabular-nums">{fmtMoney(p.officer_pay_cents)}</Td>
                    <Td className="tabular-nums">{fmtMoney(p.platform_fee_cents)}</Td>
                    <Td>
                      <StatusPill status={p.status} />
                    </Td>
                    <Td className="tabular-nums">{fmtMoney(p.refunded_cents)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Pilot">
            <ActionForm action={setCompanyPilot} submitLabel={company.is_pilot ? "Update pilot" : "Mark as pilot"}>
              <input type="hidden" name="id" value={company.id} />
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="radio" name="is_pilot" value="true" defaultChecked={company.is_pilot} className="accent-blue-600" />
                Pilot company
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="radio" name="is_pilot" value="false" defaultChecked={!company.is_pilot} className="accent-blue-600" />
                Not a pilot
              </label>
              <label htmlFor="ends_at" className="block text-sm font-semibold">
                Pilot ends <span className="font-normal text-steel-400">(default 30 days)</span>
              </label>
              <input id="ends_at" name="ends_at" type="date" defaultValue={company.pilot_ends_at ? company.pilot_ends_at.slice(0, 10) : ""} className={`${inputClasses} w-full`} />
            </ActionForm>
          </Card>

          <Card title="Plan">
            <ActionForm action={setCompanyPlan} submitLabel="Change plan" confirm="Change the plan? This does not change the Stripe subscription.">
              <input type="hidden" name="id" value={company.id} />
              <label htmlFor="plan" className="block text-sm font-semibold">
                Plan
              </label>
              <select id="plan" name="plan" defaultValue={plan?.code ?? ""} className={`${inputClasses} w-full`}>
                <option value="" disabled>
                  Select a plan
                </option>
                {plans.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name} ({fmtMoney(p.price_cents)}/mo{p.is_active ? "" : ", inactive"})
                  </option>
                ))}
              </select>
              <p className="text-xs text-navy-950/60">
                Sets the plan in the database only (subscription becomes active if it was none). Billing changes still happen in Stripe.
              </p>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function CompanyDetailPage({ params }: { params: Params }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Company" back={{ href: "/admin/companies", label: "Companies" }} />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
