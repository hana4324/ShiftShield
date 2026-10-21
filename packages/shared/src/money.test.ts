import { describe, expect, it } from "vitest";
import {
  computeSettlement,
  computeShiftCost,
  formatCents,
  formatDuration,
  formatHourlyRate,
  officerPayCents,
  platformFeeCents,
  resolveShiftWindow,
  roundCents,
  shiftMinutes,
  zonedLocalToInstant,
} from "./money";

describe("officerPayCents", () => {
  it("pays the full posted rate with no deduction ($30/hr x 4h = $120)", () => {
    expect(officerPayCents(3000, 240)).toBe(12000);
  });

  it("prorates partial hours to the minute (3h 20m at $26/hr)", () => {
    // 2600 * 200 / 60 = 8666.67 -> 8667
    expect(officerPayCents(2600, 200)).toBe(8667);
  });

  it("rounds a single minute at an odd rate correctly", () => {
    // 2633 * 1 / 60 = 43.88 -> 44
    expect(officerPayCents(2633, 1)).toBe(44);
  });

  it("rejects non-integer or negative inputs", () => {
    expect(() => officerPayCents(26.5, 60)).toThrow(RangeError);
    expect(() => officerPayCents(2600, -1)).toThrow(RangeError);
  });
});

describe("platformFeeCents", () => {
  it("computes 10% (1000 bps) on $120 = $12", () => {
    expect(platformFeeCents(12000, 1000)).toBe(1200);
  });

  it("computes 8% (800 bps) on $208 = $16.64", () => {
    expect(platformFeeCents(20800, 800)).toBe(1664);
  });

  it("rounds half away from zero (10% of $0.05 = 0.5c -> 1c)", () => {
    expect(platformFeeCents(5, 1000)).toBe(1);
  });
});

describe("computeShiftCost", () => {
  it("matches the mockup: $26/hr x 8h = $208 officer pay, 10% fee on top", () => {
    const cost = computeShiftCost({ hourlyRateCents: 2600, minutes: 480, feeBps: 1000 });
    expect(cost.officerPayCents).toBe(20800);
    expect(cost.platformFeeCents).toBe(2080);
    expect(cost.perOfficerTotalCents).toBe(22880);
    expect(cost.totalCents).toBe(22880);
  });

  it("multiplies by officers needed", () => {
    const cost = computeShiftCost({
      hourlyRateCents: 3000,
      minutes: 240,
      feeBps: 1000,
      officersNeeded: 3,
    });
    expect(cost.totalOfficerPayCents).toBe(36000);
    expect(cost.totalPlatformFeeCents).toBe(3600);
    expect(cost.totalCents).toBe(39600);
  });

  it("never changes the officer's pay when the fee changes", () => {
    const a = computeShiftCost({ hourlyRateCents: 2800, minutes: 480, feeBps: 1000 });
    const b = computeShiftCost({ hourlyRateCents: 2800, minutes: 480, feeBps: 800 });
    expect(a.officerPayCents).toBe(b.officerPayCents);
    expect(a.totalCents).toBeGreaterThan(b.totalCents);
  });
});

describe("shiftMinutes / overnight shifts", () => {
  it("counts an overnight shift across midnight (10 PM to 6 AM = 480 min)", () => {
    const start = new Date("2026-11-06T22:00:00-06:00");
    const end = new Date("2026-11-07T06:00:00-06:00");
    expect(shiftMinutes(start, end)).toBe(480);
  });

  it("throws when end is not after start", () => {
    const t = new Date("2026-11-06T22:00:00Z");
    expect(() => shiftMinutes(t, t)).toThrow(RangeError);
  });
});

describe("resolveShiftWindow (America/Chicago)", () => {
  it("rolls the end time to the next day when it is earlier than start", () => {
    const w = resolveShiftWindow("2026-11-06", "22:00", "06:00", "America/Chicago");
    expect(w.crossesMidnight).toBe(true);
    expect(w.minutes).toBe(480);
    expect(w.startAt.toISOString()).toBe("2026-11-07T04:00:00.000Z"); // CST = UTC-6
    expect(w.endAt.toISOString()).toBe("2026-11-07T12:00:00.000Z");
  });

  it("handles a same-day shift", () => {
    const w = resolveShiftWindow("2026-07-04", "17:00", "23:00", "America/Chicago");
    expect(w.crossesMidnight).toBe(false);
    expect(w.minutes).toBe(360);
    expect(w.startAt.toISOString()).toBe("2026-07-04T22:00:00.000Z"); // CDT = UTC-5
  });

  it("handles the fall-back DST night (Nov 1 2026, 1 AM repeats): 10 PM to 6 AM is 9 hours", () => {
    const w = resolveShiftWindow("2026-10-31", "22:00", "06:00", "America/Chicago");
    expect(w.minutes).toBe(540);
  });

  it("handles the spring-forward DST night (Mar 8 2026, 2 AM skipped): 10 PM to 6 AM is 7 hours", () => {
    const w = resolveShiftWindow("2026-03-07", "22:00", "06:00", "America/Chicago");
    expect(w.minutes).toBe(420);
  });

  it("converts a zoned local time to the right instant", () => {
    expect(zonedLocalToInstant("2026-01-15T12:00:00", "America/Chicago").toISOString()).toBe(
      "2026-01-15T18:00:00.000Z",
    );
  });
});

describe("computeSettlement", () => {
  it("pays full amount and refunds nothing when approved equals charged", () => {
    const s = computeSettlement({
      hourlyRateCents: 2600,
      chargedMinutes: 480,
      approvedMinutes: 480,
      feeBps: 1000,
    });
    expect(s.officerPayoutCents).toBe(20800);
    expect(s.platformFeeCents).toBe(2080);
    expect(s.chargedTotalCents).toBe(22880);
    expect(s.settledTotalCents).toBe(22880);
    expect(s.refundCents).toBe(0);
  });

  it("refunds pay and fee for unworked minutes (officer left 1h early)", () => {
    const s = computeSettlement({
      hourlyRateCents: 3000,
      chargedMinutes: 480,
      approvedMinutes: 420,
      feeBps: 1000,
    });
    expect(s.officerPayoutCents).toBe(21000); // 7h x $30
    expect(s.platformFeeCents).toBe(2100);
    expect(s.chargedTotalCents).toBe(26400); // 8h x $30 + 10%
    expect(s.refundCents).toBe(26400 - 23100);
  });

  it("caps payout at charged minutes when approved exceeds scheduled", () => {
    const s = computeSettlement({
      hourlyRateCents: 3000,
      chargedMinutes: 480,
      approvedMinutes: 510,
      feeBps: 1000,
    });
    expect(s.officerPayoutCents).toBe(24000);
    expect(s.refundCents).toBe(0);
  });

  it("refunds everything on zero approved minutes", () => {
    const s = computeSettlement({
      hourlyRateCents: 2400,
      chargedMinutes: 480,
      approvedMinutes: 0,
      feeBps: 1000,
    });
    expect(s.officerPayoutCents).toBe(0);
    expect(s.refundCents).toBe(s.chargedTotalCents);
  });

  it("keeps cents consistent with rounding on partial minutes", () => {
    const s = computeSettlement({
      hourlyRateCents: 2633,
      chargedMinutes: 475,
      approvedMinutes: 437,
      feeBps: 1000,
    });
    expect(Number.isInteger(s.officerPayoutCents)).toBe(true);
    expect(Number.isInteger(s.refundCents)).toBe(true);
    expect(s.refundCents).toBe(s.chargedTotalCents - s.settledTotalCents);
  });
});

describe("formatting", () => {
  it("formats cents", () => {
    expect(formatCents(20800)).toBe("$208.00");
    expect(formatCents(2600, { compact: true })).toBe("$26");
    expect(formatCents(2650, { compact: true })).toBe("$26.50");
    expect(formatCents(129900)).toBe("$1,299.00");
  });

  it("formats hourly rate and duration", () => {
    expect(formatHourlyRate(2600)).toBe("$26.00/hr");
    expect(formatDuration(480)).toBe("8h");
    expect(formatDuration(500)).toBe("8h 20m");
    expect(formatDuration(45)).toBe("45m");
  });

  it("rounds half away from zero", () => {
    expect(roundCents(2.5)).toBe(3);
    expect(roundCents(-2.5)).toBe(-3);
    expect(roundCents(2.4)).toBe(2);
  });
});
