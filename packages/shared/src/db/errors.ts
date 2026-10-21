import { PLAN_CAP_ERRORS, type DbErrorCode } from "./types";

/** Shape of a PostgREST / supabase-js error (also what Edge Functions forward). */
export interface PostgrestLikeError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

export interface DbError {
  code: DbErrorCode | "not_authorized" | "unknown";
  /** Human-readable text suitable for a toast. */
  message: string;
  raw?: unknown;
}

const KNOWN: ReadonlySet<string> = new Set<string>([
  "subscription_required",
  "plan_cap_shifts",
  "plan_cap_bookings",
  "plan_cap_sites",
  "plan_cap_seats",
  "plan_lead_time",
  "shift_full",
  "officer_overlap",
  "officer_not_eligible",
  "shift_unavailable",
  "shift_started",
  "license_level",
  "already_booked",
  "not_clockable",
  "not_clocked_in",
  "already_member",
  "invite_invalid",
  "invite_email_mismatch",
  "must_be_18",
]);

const FALLBACK_TEXT: Record<string, string> = {
  subscription_required: "Choose a plan to post shifts.",
  plan_cap_shifts:
    "You've reached this month's posted-shift limit for your plan. Upgrade to post more.",
  plan_cap_bookings:
    "You've reached this month's booking limit for your plan. Upgrade to book more officers.",
  plan_cap_sites: "Your plan's site limit is reached. Upgrade to add more sites.",
  plan_cap_seats: "Your plan's manager seat limit is reached. Upgrade to invite more managers.",
  plan_lead_time:
    "Your plan requires more lead time to post this shift. Upgrade to Enterprise to post any time.",
  shift_full: "All spots on this shift are filled.",
  officer_overlap: "Already booked at an overlapping time.",
  officer_not_eligible: "Finish verification before accepting shifts.",
  shift_unavailable: "This shift is no longer open.",
  shift_started: "This shift has already started.",
  license_level: "Your license level does not meet this shift's requirement.",
  already_booked: "You're already booked on this shift.",
  not_clockable: "This booking is not awaiting clock-in.",
  not_clocked_in: "You are not clocked in.",
  already_member: "You already belong to a company.",
  invite_invalid: "This invite is invalid or expired.",
  invite_email_mismatch: "Sign in with the invited email address.",
  must_be_18: "Officers must be 18 or older.",
  not_authorized: "You don't have permission to do that.",
};

/** Normalize a supabase-js error (RPC/PostgREST) into a stable code + friendly message. */
export function parseDbError(err: unknown): DbError {
  const e = (err ?? {}) as PostgrestLikeError;
  const message = (e.message ?? "").trim();
  const details = (e.details ?? "").trim();
  if (KNOWN.has(message)) {
    return {
      code: message as DbErrorCode,
      message: details || FALLBACK_TEXT[message] || message,
      raw: err,
    };
  }
  if (/not authorized/i.test(message) || e.code === "42501") {
    return { code: "not_authorized", message: FALLBACK_TEXT.not_authorized!, raw: err };
  }
  return {
    code: "unknown",
    message: message || "Something went wrong. Please try again.",
    raw: err,
  };
}

export function isPlanCapError(err: DbError): boolean {
  return (PLAN_CAP_ERRORS as readonly string[]).includes(err.code);
}

/** Blocker keys from public.officer_blockers() mapped to copy for the Accept button. */
export const BLOCKER_TEXT: Record<string, string> = {
  signup_fee: "Pay the $30 signup fee",
  background_check: "Background check pending",
  license: "Upload or renew your Texas DPS license",
  suspended: "Account suspended. Contact ShiftShield.",
  deactivated: "Account deactivated. Contact ShiftShield to appeal.",
  no_profile: "Complete your officer profile",
};
