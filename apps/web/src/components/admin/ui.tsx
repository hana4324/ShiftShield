import Link from "next/link";
import type { ReactNode } from "react";

/** Shared admin-panel primitives: slate-50 page, white cards with shadow-card, navy text. */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="text-xs font-semibold tracking-wider text-blue-700 uppercase hover:underline focus-ring rounded"
          >
            &larr; {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-navy-950/60">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
  actions,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-950/5 ${className}`}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-base font-extrabold tracking-tight">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "warn" | "alert";
}) {
  const ring =
    tone === "alert"
      ? "ring-status-red/30"
      : tone === "warn"
        ? "ring-status-amber/40"
        : "ring-navy-950/5";
  const body = (
    <>
      <p className="text-xs font-semibold tracking-wider text-steel-400 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-navy-950/60">{hint}</p> : null}
    </>
  );
  const cls = `block rounded-2xl bg-white p-4 shadow-card ring-1 ${ring}`;
  return href ? (
    <Link href={href} className={`${cls} focus-ring hover:ring-blue-600/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const pillTones = {
  gray: "bg-status-gray/20 text-navy-950/70",
  blue: "bg-blue-600/10 text-blue-700",
  green: "bg-status-green/15 text-status-green-700",
  amber: "bg-status-amber/15 text-amber-700",
  red: "bg-status-red/10 text-status-red",
  navy: "bg-navy-950 text-white",
} as const;

export type PillTone = keyof typeof pillTones;

export function Pill({ tone = "gray", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase ${pillTones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Status -> tone map shared by the list and detail screens. */
export function statusTone(status: string): PillTone {
  switch (status) {
    case "active":
    case "approved":
    case "clear":
    case "completed":
    case "captured":
    case "paid_out":
    case "auto_approved":
    case "filled":
    case "accepted":
    case "resolved_full":
      return "green";
    case "pending":
    case "onboarding":
    case "open":
    case "applied":
    case "authorized":
    case "trialing":
    case "in_progress":
    case "clocked_in":
    case "confirmed":
    case "resolved_adjusted":
      return "blue";
    case "past_due":
    case "consider":
    case "disputed":
    case "partially_refunded":
    case "suspended":
    case "incomplete":
    case "paused":
      return "amber";
    case "rejected":
    case "failed":
    case "deactivated":
    case "no_show":
    case "cancelled":
    case "canceled":
    case "refunded":
    case "cancelled_by_officer":
    case "cancelled_by_employer":
    case "expired":
    case "declined":
    case "unpaid":
    case "incomplete_expired":
    case "resolved_refund":
      return "red";
    default:
      return "gray";
  }
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={statusTone(status)}>{status.replace(/_/g, " ")}</Pill>;
}

export function NotConfigured({ what = "this screen" }: { what?: string }) {
  return (
    <div className="mt-6 rounded-2xl bg-status-amber/10 p-5 text-sm text-navy-950">
      <p className="font-bold">Supabase is not configured</p>
      <p className="mt-1">
        Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and sign in with an admin
        account to load {what}. Without them the panel runs in local demo mode (shared password,
        no data).
      </p>
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-6 rounded-2xl bg-status-red/10 p-5 text-sm text-status-red">
      {message}
    </p>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card ring-1 ring-navy-950/5">
      <p className="text-lg font-bold">{title}</p>
      {hint ? <p className="mt-1 text-sm text-navy-950/60">{hint}</p> : null}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-6 space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-navy-950/5" />
      ))}
    </div>
  );
}

/** Definition list used in detail screens. */
export function Facts({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2 | 3 | 4;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[
    columns
  ];
  return (
    <dl className={`grid gap-x-6 gap-y-3 text-sm ${cols}`}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-semibold tracking-wider text-steel-400 uppercase">
            {it.label}
          </dt>
          <dd className="mt-0.5 font-semibold break-words">{it.value ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Table({
  head,
  children,
  className = "",
}: {
  head: ReactNode[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-navy-950/5 ${className}`}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-navy-950/10 text-xs font-semibold tracking-wider text-steel-400 uppercase">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-950/5">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

export const inputClasses =
  "h-11 rounded-xl border border-navy-950/15 bg-white px-3 text-sm text-navy-950 focus-ring";

/** GET filter bar; each child is a labelled control. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <form
      method="get"
      className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy-950/5"
    >
      {children}
    </form>
  );
}

export function Tabs({
  items,
  current,
}: {
  items: Array<{ value: string; label: string; href: string; count?: number | null }>;
  current: string;
}) {
  return (
    <nav aria-label="Filter" className="mt-6 flex flex-wrap gap-1">
      {items.map((t) => {
        const active = t.value === current;
        return (
          <Link
            key={t.value}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold focus-ring ${
              active ? "bg-navy-950 text-white" : "bg-white text-navy-950/70 ring-1 ring-navy-950/10 hover:bg-slate-50"
            }`}
          >
            {t.label}
            {typeof t.count === "number" ? (
              <span className={`ml-1.5 tabular-nums ${active ? "text-white/70" : "text-steel-400"}`}>
                {t.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-xs leading-relaxed text-navy-950/80">
      {value === null || value === undefined ? "null" : JSON.stringify(value, null, 2)}
    </pre>
  );
}
