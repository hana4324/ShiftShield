/**
 * Fee and payout math. All amounts are integer cents. All durations are integer minutes.
 *
 * Business rules (see spec section 2):
 * - The employer sets the hourly rate. ShiftShield never changes it and the officer never sees a deduction.
 * - The platform fee is charged to the employer ON TOP of the officer's pay.
 *   $30/hr x 4h  => officer receives $120.00; employer pays $120.00 + fee.
 * - Fee is expressed in basis points (1000 bps = 10%).
 */

export interface ShiftCostInput {
  hourlyRateCents: number;
  minutes: number;
  feeBps: number;
  officersNeeded?: number;
}

export interface ShiftCostBreakdown {
  /** Pay for ONE officer for the full scheduled duration. */
  officerPayCents: number;
  /** Platform fee for ONE officer. */
  platformFeeCents: number;
  /** officerPayCents + platformFeeCents for ONE officer. */
  perOfficerTotalCents: number;
  officersNeeded: number;
  /** Totals across all officers needed. */
  totalOfficerPayCents: number;
  totalPlatformFeeCents: number;
  totalCents: number;
}

function assertNonNegativeInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
}

/** Round half away from zero to the nearest integer cent. */
export function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Officer pay for a number of minutes at an hourly rate. Partial hours are prorated to the minute. */
export function officerPayCents(hourlyRateCents: number, minutes: number): number {
  assertNonNegativeInt(hourlyRateCents, "hourlyRateCents");
  assertNonNegativeInt(minutes, "minutes");
  return roundCents((hourlyRateCents * minutes) / 60);
}

/** Platform fee on a pay amount, in cents. */
export function platformFeeCents(payCents: number, feeBps: number): number {
  assertNonNegativeInt(payCents, "payCents");
  assertNonNegativeInt(feeBps, "feeBps");
  return roundCents((payCents * feeBps) / 10_000);
}

/**
 * Full cost preview shown to the employer before publishing:
 * officer pay + platform fee = total.
 */
export function computeShiftCost(input: ShiftCostInput): ShiftCostBreakdown {
  const officersNeeded = input.officersNeeded ?? 1;
  assertNonNegativeInt(officersNeeded, "officersNeeded");
  const pay = officerPayCents(input.hourlyRateCents, input.minutes);
  const fee = platformFeeCents(pay, input.feeBps);
  return {
    officerPayCents: pay,
    platformFeeCents: fee,
    perOfficerTotalCents: pay + fee,
    officersNeeded,
    totalOfficerPayCents: pay * officersNeeded,
    totalPlatformFeeCents: fee * officersNeeded,
    totalCents: (pay + fee) * officersNeeded,
  };
}

/**
 * Minutes between two instants. Handles overnight shifts because callers store
 * absolute timestamps (end_at is simply the next calendar day).
 * Throws if end is not after start.
 */
export function shiftMinutes(startAt: Date, endAt: Date): number {
  const ms = endAt.getTime() - startAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new RangeError("endAt must be after startAt");
  }
  return Math.round(ms / 60_000);
}

/**
 * Resolve a shift's absolute start/end from a calendar date + "HH:MM" times in a given IANA time zone.
 * If endTime <= startTime the shift crosses midnight and ends on the next day.
 *
 * `toInstant` is injected so callers can use their platform's tz library (date-fns-tz, Temporal, etc.).
 * The default uses Intl and works in Node, browsers, and Hermes.
 */
export function resolveShiftWindow(
  date: string,
  startTime: string,
  endTime: string,
  timeZone: string,
  toInstant: (localIso: string, tz: string) => Date = zonedLocalToInstant,
): { startAt: Date; endAt: Date; minutes: number; crossesMidnight: boolean } {
  const startAt = toInstant(`${date}T${startTime}:00`, timeZone);
  let endAt = toInstant(`${date}T${endTime}:00`, timeZone);
  let crossesMidnight = false;
  if (endAt.getTime() <= startAt.getTime()) {
    const next = addCalendarDays(date, 1);
    endAt = toInstant(`${next}T${endTime}:00`, timeZone);
    crossesMidnight = true;
  }
  return { startAt, endAt, minutes: shiftMinutes(startAt, endAt), crossesMidnight };
}

function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Convert a wall-clock local time in `tz` to an instant, using Intl only.
 * Accurate across DST transitions via a two-pass offset correction.
 */
export function zonedLocalToInstant(localIso: string, tz: string): Date {
  const [datePart, timePart = "00:00:00"] = localIso.split("T") as [string, string?];
  const [y, mo, d] = datePart.split("-").map(Number) as [number, number, number];
  const [h, mi, s = 0] = timePart.split(":").map(Number) as [number, number, number?];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset1 = tzOffsetMs(asUtc, tz);
  const guess = asUtc - offset1;
  const offset2 = tzOffsetMs(guess, tz);
  return new Date(asUtc - offset2);
}

function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asIfUtc - utcMs;
}

export interface SettlementInput {
  hourlyRateCents: number;
  /** Minutes originally charged to the employer at confirmation (scheduled duration). */
  chargedMinutes: number;
  /** Minutes the employer approved after clock-out. */
  approvedMinutes: number;
  feeBps: number;
}

export interface Settlement {
  /** Amount to transfer to the officer's Connect account. */
  officerPayoutCents: number;
  /** Platform fee retained, recomputed on approved pay. */
  platformFeeCents: number;
  /** Amount originally captured from the employer. */
  chargedTotalCents: number;
  /** Amount the employer ultimately owes (approved pay + fee on approved pay). */
  settledTotalCents: number;
  /** Difference refunded to the employer. Zero when approved >= charged. */
  refundCents: number;
}

/**
 * Settlement after timesheet approval.
 * Officer is paid for approved minutes. If approved < charged, the employer is refunded
 * the difference (pay and fee). Approved minutes above the charged minutes are capped at
 * the charged amount here; overtime beyond the scheduled window needs an additional charge
 * (handled by the approve-timesheet function, not by this pure helper).
 */
export function computeSettlement(input: SettlementInput): Settlement {
  assertNonNegativeInt(input.chargedMinutes, "chargedMinutes");
  assertNonNegativeInt(input.approvedMinutes, "approvedMinutes");
  const chargedPay = officerPayCents(input.hourlyRateCents, input.chargedMinutes);
  const chargedFee = platformFeeCents(chargedPay, input.feeBps);
  const chargedTotal = chargedPay + chargedFee;

  const effectiveMinutes = Math.min(input.approvedMinutes, input.chargedMinutes);
  const approvedPay = officerPayCents(input.hourlyRateCents, effectiveMinutes);
  const approvedFee = platformFeeCents(approvedPay, input.feeBps);
  const settledTotal = approvedPay + approvedFee;

  return {
    officerPayoutCents: approvedPay,
    platformFeeCents: approvedFee,
    chargedTotalCents: chargedTotal,
    settledTotalCents: settledTotal,
    refundCents: Math.max(0, chargedTotal - settledTotal),
  };
}

/** "$26.00" style formatting. */
export function formatCents(cents: number, opts: { compact?: boolean } = {}): string {
  const dollars = cents / 100;
  if (opts.compact && Number.isInteger(dollars)) {
    return `$${dollars.toLocaleString("en-US")}`;
  }
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "$26.00/hr" */
export function formatHourlyRate(hourlyRateCents: number): string {
  return `${formatCents(hourlyRateCents)}/hr`;
}

/** "8h" / "8h 30m" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
