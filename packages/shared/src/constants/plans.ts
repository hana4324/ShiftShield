/**
 * Default subscription tiers. These are seeded into the `plans` table and enforced server-side.
 * The DB row is the source of truth at runtime; admins can edit it from the admin panel.
 * See OPEN_QUESTIONS.md for the numbers the client is still deciding.
 */
export type PlanCode = "essential" | "pro" | "enterprise";

export interface PlanSeed {
  code: PlanCode;
  name: string;
  priceCents: number;
  /** Confirmed officer-shift assignments per billing period. null = unlimited. */
  monthlyBookingCap: number | null;
  /** Published shifts per billing period. null = unlimited. */
  monthlyShiftCap: number | null;
  /** Minimum lead time between posting and shift start. 0 = post any time ("Fill Now"). */
  minLeadTimeMinutes: number;
  maxSites: number | null;
  maxSeats: number | null;
  /** Platform fee charged to the employer on top of officer pay, in basis points (1000 = 10%). */
  feeBps: number;
  dailyPayEnabled: boolean;
  features: {
    reviewOrAutoFill: boolean;
    liveMapAndGps: boolean;
    reports: "none" | "csv" | "csv_analytics";
    priorityMatching: "none" | "high" | "highest";
  };
  /** Marketing copy for the landing page and in-app upgrade prompts. */
  blurb: string;
  highlight?: boolean;
}

export const PLANS: readonly PlanSeed[] = [
  {
    code: "essential",
    name: "Essential",
    priceCents: 19900,
    monthlyBookingCap: 15,
    monthlyShiftCap: 15,
    minLeadTimeMinutes: 24 * 60,
    maxSites: 1,
    maxSeats: 1,
    feeBps: 1000,
    dailyPayEnabled: false,
    features: {
      reviewOrAutoFill: true,
      liveMapAndGps: true,
      reports: "none",
      priorityMatching: "none",
    },
    blurb: "For a single property that needs reliable backup coverage.",
  },
  {
    code: "pro",
    name: "Pro",
    priceCents: 49900,
    monthlyBookingCap: 40,
    monthlyShiftCap: 40,
    minLeadTimeMinutes: 4 * 60,
    maxSites: 5,
    maxSeats: 5,
    feeBps: 1000,
    dailyPayEnabled: false,
    features: {
      reviewOrAutoFill: true,
      liveMapAndGps: true,
      reports: "csv",
      priorityMatching: "high",
    },
    blurb: "For security companies and multi-site operators filling shifts every week.",
    highlight: true,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    priceCents: 129900,
    monthlyBookingCap: null,
    monthlyShiftCap: null,
    minLeadTimeMinutes: 0,
    maxSites: null,
    maxSeats: null,
    feeBps: 800,
    dailyPayEnabled: true,
    features: {
      reviewOrAutoFill: true,
      liveMapAndGps: true,
      reports: "csv_analytics",
      priorityMatching: "highest",
    },
    blurb: "For portfolios and hospital systems that need coverage at any hour.",
  },
];

export const PILOT_TRIAL_DAYS = 30;

/** Default platform settings; seeded into `platform_settings` and editable by admins. */
export const PLATFORM_SETTING_DEFAULTS = {
  signup_fee_cents: 3000,
  geofence_radius_m: 150,
  location_ping_interval_sec: 300,
  clock_in_early_minutes: 15,
  no_show_after_minutes: 30,
  late_cancel_hours: 12,
  auto_approve_hours: 24,
  deactivate_min_rating: 4.0,
  deactivate_min_rated_shifts: 10,
  deactivate_no_shows_90d: 2,
  deactivate_late_cancels_90d: 3,
  location_ping_retention_days: 90,
  license_expiry_warning_days: [30, 14, 3],
  reminder_hours_before: [24, 2],
  default_travel_radius_mi: 25,
} as const;

export function formatPlanPrice(priceCents: number): string {
  return `$${(priceCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatCap(cap: number | null): string {
  return cap === null ? "Unlimited" : String(cap);
}

export function formatLeadTime(minutes: number): string {
  if (minutes === 0) return "None (Fill Now)";
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

export function formatFeeBps(bps: number): string {
  return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
