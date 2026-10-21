/**
 * ShiftShield design tokens.
 *
 * Single source of truth for brand colors, type, spacing and radii.
 * - Web: mirrored in apps/web/src/app/globals.css (`@theme`) for Tailwind v4.
 * - Mobile: consumed directly from here.
 *
 * Look: dark navy app chrome, white content cards, bright blue primary actions.
 * Confident, clean, trustworthy, a little "tactical" but not militaristic.
 */

export const colors = {
  navy: {
    950: "#07111F", // app background
    900: "#0B1F3B", // surfaces, headers
    800: "#13294B",
  },
  blue: {
    600: "#1E63E9", // primary buttons, links, map pins
    700: "#0A4FB5", // logo blue, pressed states
  },
  steel: {
    400: "#9A9FA6", // logo gray, secondary text on dark
  },
  white: "#FFFFFF", // cards
  slate: {
    50: "#F4F6FA", // page background on web
  },
  status: {
    green: "#22C55E", // available, pay, filled
    greenDark: "#15803D", // pill backgrounds with white text (AA contrast)
    amber: "#F59E0B", // searching, pending
    red: "#EF4444", // no-show, expired, rejected
    gray: "#9A9FA6", // draft
  },
} as const;

export const fonts = {
  sans: "Inter",
  /** Fallback stack used anywhere Inter has not loaded. */
  fallback: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Minimum touch target (points) for accessibility. */
export const MIN_TOUCH_TARGET = 44;

export type StatusTone = "green" | "amber" | "red" | "gray" | "blue";

/** Shift / officer status to tone mapping used by StatusBadge on web and mobile. */
export const statusTone: Record<string, StatusTone> = {
  available: "green",
  filled: "green",
  paid: "green",
  approved: "green",
  clear: "green",
  active: "green",
  searching: "amber",
  pending: "amber",
  open: "amber",
  applied: "amber",
  no_show: "red",
  expired: "red",
  rejected: "red",
  failed: "red",
  cancelled: "red",
  suspended: "red",
  deactivated: "red",
  draft: "gray",
  unavailable: "gray",
  in_progress: "blue",
  clocked_in: "blue",
};
