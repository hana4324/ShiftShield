/**
 * Contracts for the Supabase Edge Functions (supabase/functions/*).
 * Every function takes a JSON body, requires the user's JWT (except stripe-webhook and the
 * cron-invoked drains, which use the service role), and returns `ApiResponse<T>`.
 */

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export type ApiResponse<T> = T | ApiError;

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "error" in value;
}

export const EDGE_FUNCTIONS = {
  createSignupFeeCheckout: "create-signup-fee-checkout",
  createSubscriptionCheckout: "create-subscription-checkout",
  createBillingPortalSession: "create-billing-portal-session",
  createConnectOnboardingLink: "create-connect-onboarding-link",
  acceptShift: "accept-shift",
  confirmApplicant: "confirm-applicant",
  clockIn: "clock-in",
  clockOut: "clock-out",
  approveTimesheet: "approve-timesheet",
  cashOutInstant: "cash-out-instant",
  sendPush: "send-push",
  matchAndNotify: "match-and-notify",
  stripeWebhook: "stripe-webhook",
  reconcilePayments: "reconcile-payments",
  inviteManager: "invite-manager",
  backgroundCheck: "background-check",
} as const;

export type EdgeFunctionName = (typeof EDGE_FUNCTIONS)[keyof typeof EDGE_FUNCTIONS];

// ---------- Stripe: officer signup fee ----------
export interface CreateSignupFeeCheckoutRequest {
  /** Where Stripe sends the user after payment (deep link for mobile, URL for web). */
  success_url: string;
  cancel_url: string;
}
export interface CreateSignupFeeCheckoutResponse {
  checkout_url: string;
  session_id: string;
  amount_cents: number;
}

// ---------- Stripe: employer subscription ----------
export interface CreateSubscriptionCheckoutRequest {
  plan_code: "essential" | "pro" | "enterprise";
  success_url: string;
  cancel_url: string;
}
export interface CreateSubscriptionCheckoutResponse {
  checkout_url: string;
  session_id: string;
  trial_days: number;
}

export interface CreateBillingPortalSessionRequest {
  return_url: string;
}
export interface CreateBillingPortalSessionResponse {
  portal_url: string;
}

// ---------- Stripe Connect Express ----------
export interface CreateConnectOnboardingLinkRequest {
  return_url: string;
  refresh_url: string;
}
export interface CreateConnectOnboardingLinkResponse {
  onboarding_url: string;
  account_id: string;
  payouts_enabled: boolean;
}

// ---------- Marketplace ----------
export interface AcceptShiftRequest {
  shift_id: string;
  message?: string;
}
export type AcceptShiftResponse =
  | {
      outcome: "booked";
      assignment_id: string;
      payment_status: "authorized" | "pending" | "failed";
    }
  | { outcome: "applied"; application_id: string };

export interface ConfirmApplicantRequest {
  application_id: string;
}
export interface ConfirmApplicantResponse {
  assignment_id: string;
  payment_status: "authorized" | "pending" | "failed";
  failure_message?: string;
}

export interface ClockInRequest {
  assignment_id: string;
  lat: number;
  lng: number;
  accuracy_m?: number;
}
export type ClockInResponse =
  | { ok: true; clock_in_at: string; distance_m: number }
  | { ok: false; reason: "too_early"; opens_at: string }
  | { ok: false; reason: "outside_geofence"; distance_m: number; radius_m: number };

export interface ClockOutRequest {
  assignment_id: string;
  lat: number;
  lng: number;
  accuracy_m?: number;
  notes?: string;
}
export interface ClockOutResponse {
  ok: true;
  worked_minutes: number;
}

export interface ApproveTimesheetRequest {
  assignment_id: string;
  approved_minutes?: number;
}
export interface ApproveTimesheetResponse {
  assignment_id: string;
  approved_minutes: number;
  officer_payout_cents: number;
  platform_fee_cents: number;
  refund_cents: number;
  transfer_id: string | null;
  refund_id: string | null;
}

export interface CashOutInstantRequest {
  /** Omit to cash out the full available balance. */
  amount_cents?: number;
}
export interface CashOutInstantResponse {
  payout_id: string;
  amount_cents: number;
  arrival_estimate: string;
}

export interface MatchAndNotifyRequest {
  shift_id: string;
}
export interface MatchAndNotifyResponse {
  candidates: number;
  notified: number;
  sms_queued: number;
}

export interface SendPushResponse {
  sent: number;
  failed: number;
  skipped: number;
}

export interface InviteManagerRequest {
  email: string;
}
export interface InviteManagerResponse {
  invite_id: string;
  expires_at: string;
}

// ---------- Background check provider abstraction ----------
export interface BackgroundCheckRequest {
  action: "start" | "status" | "manual_set";
  officer_id?: string;
  /** manual_set only (admins) */
  status?: "not_started" | "pending" | "clear" | "consider" | "failed";
  reference?: string;
}
export interface BackgroundCheckResponse {
  provider: string;
  status: "not_started" | "pending" | "clear" | "consider" | "failed";
  reference: string | null;
}

/** Expo push message (subset of https://docs.expo.dev/push-notifications/sending-notifications/). */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}
