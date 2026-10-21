import {
  PILOT_TRIAL_DAYS,
  PLANS,
  formatCap,
  formatFeeBps,
  formatLeadTime,
  formatPlanPrice,
  type PlanSeed,
} from "@shiftshield/shared";
import { Icons } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, Heading, Lede, Section } from "./section";

type Row = { label: string; value: (p: PlanSeed) => string | boolean };

const rows: Row[] = [
  { label: "Officer bookings / month", value: (p) => formatCap(p.monthlyBookingCap) },
  { label: "Posted shifts / month", value: (p) => formatCap(p.monthlyShiftCap) },
  { label: "Minimum lead time to post", value: (p) => formatLeadTime(p.minLeadTimeMinutes) },
  {
    label: "Sites",
    value: (p) =>
      p.maxSites === null ? "Unlimited" : p.maxSites === 1 ? "1" : `Up to ${p.maxSites}`,
  },
  { label: "Manager seats", value: (p) => formatCap(p.maxSeats) },
  { label: "Review applicants or auto-fill", value: () => true },
  { label: "Live officer map + GPS attendance", value: () => true },
  {
    label: "Reports / CSV export",
    value: (p) =>
      p.features.reports === "none"
        ? false
        : p.features.reports === "csv"
          ? "CSV"
          : "CSV + analytics",
  },
  {
    label: "Priority matching",
    value: (p) =>
      p.features.priorityMatching === "none"
        ? false
        : p.features.priorityMatching === "high"
          ? "Notified first"
          : "Highest priority",
  },
  { label: "Daily pay for officers", value: (p) => p.dailyPayEnabled },
  { label: "Platform fee on completed shifts", value: (p) => formatFeeBps(p.feeBps) },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true)
    return <Icons.Check size={18} className="text-status-green" aria-label="Included" />;
  if (v === false)
    return <Icons.Minus size={18} className="text-steel-400" aria-label="Not included" />;
  return <span className="text-sm font-medium">{v}</span>;
}

export function Plans() {
  return (
    <Section id="plans" tone="light">
      <Eyebrow>Plans</Eyebrow>
      <Heading>Simple monthly plans. You set the officer&apos;s rate.</Heading>
      <Lede>
        The platform fee is added on top of the hourly rate you post, so the officer always receives
        the full amount they saw. Pilot participants get {PILOT_TRIAL_DAYS} days before billing
        starts.
      </Lede>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.code}
            className={`relative flex flex-col rounded-3xl bg-white p-7 shadow-card ring-1 ${
              p.highlight ? "ring-2 ring-blue-600" : "ring-navy-950/5"
            }`}
          >
            {p.highlight ? (
              <span className="absolute -top-3 left-7 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold tracking-wider text-white uppercase">
                Most popular
              </span>
            ) : null}
            <h3 className="text-xl font-extrabold tracking-tight">{p.name}</h3>
            <p className="mt-1 min-h-10 text-sm text-navy-950/60">{p.blurb}</p>
            <p className="mt-5 flex items-baseline gap-1">
              <span className="text-5xl font-extrabold tracking-tight">
                {formatPlanPrice(p.priceCents)}
              </span>
              <span className="text-sm font-semibold text-steel-400">/mo</span>
            </p>
            <dl className="mt-6 space-y-3 border-t border-navy-950/10 pt-6">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 text-[15px]">
                  <dt className="text-navy-950/70">{r.label}</dt>
                  <dd className="shrink-0 text-right font-semibold">
                    <Cell v={r.value(p)} />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-7">
              <ButtonLink
                href="#pilot"
                variant={p.highlight ? "primary" : "white"}
                className="w-full"
              >
                Start with {p.name}
              </ButtonLink>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-navy-900 p-5 text-sm text-steel-400 ring-1 ring-white/10 sm:flex sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-white">Example:</span> a shift posted at $30/hr for 4
          hours pays the officer $120.00. On Pro, your total is $132.00 ($120 + 10% platform fee).
        </p>
        <p className="mt-2 sm:mt-0 sm:ml-6 sm:shrink-0">
          Officers pay a one-time $30 signup fee that covers their background check.
        </p>
      </div>
    </Section>
  );
}
