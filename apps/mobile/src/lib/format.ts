import { BUSINESS } from "@shiftshield/shared/constants";

const TZ = BUSINESS.timeZone; // America/Chicago: every Texas site shows site-local time.

/** Clock snapshot for render-time comparisons (kept out of components so the React Compiler purity rule stays happy). */
export function nowMs(): number {
  return Date.now();
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtTimeRange(startIso: string, endIso: string): string {
  return `${fmtTime(startIso)} - ${fmtTime(endIso)}`;
}

export function fmtDate(iso: string, opts: { weekday?: boolean } = {}): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: opts.weekday === false ? undefined : "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** "Tonight", "Tomorrow", or a short date, relative to now in site time. */
export function fmtDayLabel(iso: string, now: Date = new Date()): string {
  const day = (d: Date) =>
    d.toLocaleDateString("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  const target = new Date(iso);
  const today = day(now);
  const tomorrow = day(new Date(now.getTime() + 86_400_000));
  const t = day(target);
  if (t === today) return "Today";
  if (t === tomorrow) return "Tomorrow";
  return fmtDate(iso);
}

export function fmtRelative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function fmtMiles(mi: number): string {
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
