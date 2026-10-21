import { BUSINESS, formatCents, formatDuration } from "@shiftshield/shared";

const TZ = BUSINESS.timeZone;

/** "Oct 20, 2026, 3:04 PM" in Central time. Parsing an ISO string is deterministic (prerender-safe). */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Calendar date ("2026-10-20" or ISO) -> "Oct 20, 2026". */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return d.toLocaleDateString("en-US", {
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const fmtMoney = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "-" : formatCents(cents);

export const fmtMinutes = (minutes: number | null | undefined) =>
  minutes === null || minutes === undefined ? "-" : formatDuration(minutes);

export function fmtPct(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : `${value}%`;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "-";
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Minutes between two ISO timestamps (rounded). */
export function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
}

/** Index rows by a key for cheap in-memory joins (admin screens are small). */
export function indexBy<T, K extends string | number>(rows: readonly T[], key: (row: T) => K) {
  const map = new Map<K, T>();
  for (const r of rows) map.set(key(r), r);
  return map;
}

export function groupBy<T, K extends string | number>(rows: readonly T[], key: (row: T) => K) {
  const map = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

export function uniq<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}
