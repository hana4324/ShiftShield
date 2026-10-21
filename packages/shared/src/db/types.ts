/**
 * Database types for ShiftShield (hand-maintained mirror of supabase/migrations).
 *
 * Regenerate from a live project when one exists:
 *   pnpm gen:types   ->  supabase gen types typescript --linked > packages/shared/src/db/types.ts
 * Until then keep this file in sync with the migrations; the db tests exercise the real schema.
 */

// ---------- Enums ----------
export type AppRole = "officer" | "employer_owner" | "employer_manager" | "admin";
export type OfficerAccountStatus = "onboarding" | "active" | "suspended" | "deactivated";
export type BackgroundStatus = "not_started" | "pending" | "clear" | "consider" | "failed";
export type LicenseStatus = "pending" | "approved" | "rejected" | "expired" | "suspended";
export type CompanyTypeEnum =
  | "security_company"
  | "senior_living"
  | "apartment"
  | "hospital"
  | "hotel"
  | "construction"
  | "corporate"
  | "event"
  | "retail"
  | "other";
export type SiteTypeEnum =
  | "senior_living"
  | "hospital"
  | "apartment"
  | "hotel"
  | "construction"
  | "corporate"
  | "event"
  | "retail"
  | "other";
export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";
export type PlanCodeEnum = "essential" | "pro" | "enterprise";
export type CompanyMemberRole = "owner" | "manager";
export type ShiftStatus = "draft" | "open" | "filled" | "in_progress" | "completed" | "cancelled";
export type FillMode = "review" | "auto";
export type ApplicationStatus = "applied" | "accepted" | "declined" | "withdrawn";
export type AssignmentStatus =
  | "confirmed"
  | "clocked_in"
  | "completed"
  | "no_show"
  | "cancelled_by_officer"
  | "cancelled_by_employer";
export type ApprovalStatus = "pending" | "approved" | "disputed" | "auto_approved";
export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "partially_refunded"
  | "refunded"
  | "paid_out"
  | "canceled";
export type RatingDirection = "employer_to_officer" | "officer_to_employer";
export type StrikeType = "no_show" | "late_cancel";
export type IncidentType =
  | "medical"
  | "theft"
  | "trespass"
  | "altercation"
  | "property_damage"
  | "suspicious_activity"
  | "fire_safety"
  | "other";
export type DisputeStatus = "open" | "resolved_full" | "resolved_adjusted" | "resolved_refund";
export type WaitlistKind = "employer" | "officer";
export type WaitlistStatusEnum = "new" | "contacted" | "pilot" | "declined";

/** PostGIS point as returned by public.geo_to_json(). Raw geography columns are opaque strings. */
export type GeoJsonPoint = {
  lat: number;
  lng: number;
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---------- Rows ----------
export type ProfileRow = {
  id: string;
  role: AppRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
};

export type LicenseTypeRow = {
  id: string;
  state: string;
  code: string;
  name: string;
  level: number;
  armed: boolean;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OfficerProfileRow = {
  user_id: string;
  home_geo: string | null;
  home_city: string | null;
  home_zip: string | null;
  travel_radius_mi: number;
  is_available: boolean;
  is_18_plus: boolean;
  is_21_plus: boolean;
  signup_fee_paid_at: string | null;
  signup_fee_checkout_session_id: string | null;
  background_status: BackgroundStatus;
  background_provider: string | null;
  background_reference: string | null;
  background_updated_at: string | null;
  account_status: OfficerAccountStatus;
  status_reason: string | null;
  rating_avg: number;
  rating_count: number;
  completed_shifts: number;
  no_show_count: number;
  late_cancel_count: number;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  instant_payouts_enabled: boolean;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OfficerLicenseRow = {
  id: string;
  officer_id: string;
  license_type_id: string;
  license_number: string;
  expires_on: string;
  front_path: string;
  back_path: string;
  status: LicenseStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  warned_30: boolean;
  warned_14: boolean;
  warned_3: boolean;
  created_at: string;
  updated_at: string;
};

export type OfficerCertificationRow = {
  id: string;
  officer_id: string;
  name: string;
  issued_on: string | null;
  expires_on: string | null;
  document_path: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanRow = {
  id: string;
  code: PlanCodeEnum;
  name: string;
  price_cents: number;
  monthly_booking_cap: number | null;
  monthly_shift_cap: number | null;
  min_lead_time_minutes: number;
  max_sites: number | null;
  max_seats: number | null;
  fee_bps: number;
  daily_pay_enabled: boolean;
  priority_rank: number;
  features: Json;
  stripe_price_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  dba: string | null;
  type: CompanyTypeEnum;
  phone: string | null;
  billing_email: string | null;
  logo_path: string | null;
  dps_license_no: string | null;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  default_payment_method_id: string | null;
  is_pilot: boolean;
  pilot_ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyMemberRow = {
  company_id: string;
  user_id: string;
  role: CompanyMemberRole;
  created_at: string;
  updated_at: string;
};

export type CompanyInviteRow = {
  id: string;
  company_id: string;
  email: string;
  role: CompanyMemberRole;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteRow = {
  id: string;
  company_id: string;
  name: string;
  site_type: SiteTypeEnum;
  address: string;
  geo: string;
  geofence_radius_m: number;
  photo_path: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  post_orders: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PlatformSettingRow = {
  key: string;
  value: Json;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export type UserAgreementRow = {
  id: string;
  user_id: string;
  doc_slug: string;
  version: string;
  accepted_at: string;
  ip_hash: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Json | null;
  after: Json | null;
  created_at: string;
};

export type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android" | "web";
  device_name: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  data: Json;
  read_at: string | null;
  created_at: string;
};

export type PushQueueRow = {
  id: number;
  user_id: string;
  title: string;
  body: string;
  data: Json;
  channel: "push" | "sms" | "email";
  status: "queued" | "sent" | "failed" | "skipped";
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

export type ShiftRequirement = {
  key: string;
  label: string;
};

export type ShiftRow = {
  id: string;
  company_id: string;
  site_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  hourly_rate_cents: number;
  officers_needed: number;
  required_license_level: number;
  armed_required: boolean;
  requirements: ShiftRequirement[];
  fill_mode: FillMode;
  is_urgent: boolean;
  status: ShiftStatus;
  created_by: string | null;
  published_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  created_at: string;
  updated_at: string;
};

export type ShiftApplicationRow = {
  id: string;
  shift_id: string;
  officer_id: string;
  status: ApplicationStatus;
  message: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentRow = {
  id: string;
  shift_id: string;
  officer_id: string;
  status: AssignmentStatus;
  clock_in_at: string | null;
  clock_in_geo: string | null;
  clock_in_accuracy_m: number | null;
  clock_in_override: boolean;
  override_requested_at: string | null;
  clock_out_at: string | null;
  clock_out_geo: string | null;
  clock_out_accuracy_m: number | null;
  clock_out_notes: string | null;
  approved_minutes: number | null;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  no_show_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LocationPingRow = {
  id: number;
  assignment_id: string;
  geo: string;
  accuracy_m: number | null;
  recorded_at: string;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  assignment_id: string;
  company_id: string;
  officer_id: string;
  officer_pay_cents: number;
  platform_fee_cents: number;
  total_cents: number;
  fee_bps: number;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  stripe_payout_id: string | null;
  status: PaymentStatus;
  refunded_cents: number;
  paid_out_cents: number;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

export type RatingRow = {
  id: string;
  assignment_id: string;
  rater_id: string;
  ratee_id: string;
  direction: RatingDirection;
  stars: number;
  tags: string[];
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type StrikeRow = {
  id: string;
  officer_id: string;
  assignment_id: string | null;
  type: StrikeType;
  notes: string | null;
  created_at: string;
};

export type DisputeRow = {
  id: string;
  assignment_id: string;
  opened_by: string;
  reason: string;
  employer_notes: string | null;
  officer_notes: string | null;
  status: DisputeStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  resolved_minutes: number | null;
  created_at: string;
  updated_at: string;
};

export type IncidentReportRow = {
  id: string;
  assignment_id: string;
  shift_id: string;
  company_id: string;
  officer_id: string;
  type: IncidentType;
  description: string;
  occurred_at: string;
  geo: string | null;
  photo_paths: string[];
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageThreadRow = {
  id: string;
  shift_id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type SavedShiftRow = {
  officer_id: string;
  shift_id: string;
  created_at: string;
};

export type StripeEventRow = {
  id: string;
  type: string;
  payload: Json | null;
  processed_at: string;
  created_at: string;
};

export type WaitlistLeadRowDb = {
  id: string;
  kind: WaitlistKind;
  status: WaitlistStatusEnum;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  notes: string | null;
  company_name: string | null;
  title: string | null;
  company_type: string | null;
  site_count: number | null;
  shifts_per_month: number | null;
  shift_types: string[];
  coverage_timeline: string | null;
  license_level: string | null;
  source: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  utm: Json | null;
  admin_notes: string | null;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

// ---------- Views ----------
export type OfficerPublicProfileRow = {
  user_id: string;
  full_name: string;
  avatar_path: string | null;
  home_city: string | null;
  rating_avg: number;
  rating_count: number;
  completed_shifts: number;
  account_status: OfficerAccountStatus;
  reliability_pct: number;
  license_level: number | null;
  armed_approved: boolean;
};

// ---------- RPC payloads ----------
export type ShiftCost = {
  minutes: number;
  officer_pay_cents: number;
  platform_fee_cents: number;
  per_officer_total_cents: number;
  officers_needed: number;
  total_cents: number;
  fee_bps: number;
};

export type CompanyUsage = {
  plan_code: PlanCodeEnum;
  plan_name: string;
  period_start: string;
  period_end: string;
  bookings_used: number;
  booking_cap: number | null;
  shifts_used: number;
  shift_cap: number | null;
  sites_used: number;
  site_cap: number | null;
  seats_used: number;
  seat_cap: number | null;
  min_lead_time_minutes: number;
  fee_bps: number;
  daily_pay_enabled: boolean;
};

export type CompanyCard = {
  company_id: string;
  company_name: string;
  company_type: CompanyTypeEnum;
  logo_path: string | null;
};

/** One row of public.shift_feed(). */
export type ShiftFeedRow = {
  shift: Omit<ShiftRow, "requirements"> & { requirements: ShiftRequirement[]; cost: ShiftCost };
  site: Omit<SiteRow, "geo"> & { geo: GeoJsonPoint };
  company: CompanyCard | null;
  distance_mi: number | null;
  booked: number;
  my_assignment_id: string | null;
  my_application_status: ApplicationStatus | null;
  saved: boolean;
};

export type AcceptShiftResult =
  { outcome: "booked"; assignment_id: string } | { outcome: "applied"; application_id: string };

export type ClockInResult =
  | { ok: true; clock_in_at: string; distance_m: number }
  | { ok: false; reason: "too_early"; opens_at: string }
  | { ok: false; reason: "outside_geofence"; distance_m: number; radius_m: number };

export type ClockOutResult = {
  ok: true;
  worked_minutes: number;
};

export type MatchCandidate = {
  officer_id: string;
  distance_mi: number;
  rating_avg: number;
  license_level: number;
  priority_rank: number;
};

export type AdminOverview = {
  officers_by_status: Record<OfficerAccountStatus, number>;
  licenses_pending: number;
  companies_by_plan: Record<string, number>;
  shifts_this_week: number;
  fill_rate_pct: number | null;
  gross_volume_cents_30d: number;
  platform_fees_cents_30d: number;
  mrr_cents: number;
  open_disputes: number;
  incidents_7d: number;
  waitlist_new: number;
};

/** Known business-rule error codes raised by the SQL functions (message = code, detail = human text). */
export type DbErrorCode =
  | "subscription_required"
  | "plan_cap_shifts"
  | "plan_cap_bookings"
  | "plan_cap_sites"
  | "plan_cap_seats"
  | "plan_lead_time"
  | "shift_full"
  | "officer_overlap"
  | "officer_not_eligible"
  | "shift_unavailable"
  | "shift_started"
  | "license_level"
  | "already_booked"
  | "not_clockable"
  | "not_clocked_in"
  | "already_member"
  | "invite_invalid"
  | "invite_email_mismatch"
  | "must_be_18";

export const PLAN_CAP_ERRORS: readonly DbErrorCode[] = [
  "plan_cap_shifts",
  "plan_cap_bookings",
  "plan_cap_sites",
  "plan_cap_seats",
  "plan_lead_time",
  "subscription_required",
];

// ---------- supabase-js generic ----------
type TableDef<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>;
      license_types: TableDef<LicenseTypeRow>;
      officer_profiles: TableDef<OfficerProfileRow>;
      officer_licenses: TableDef<OfficerLicenseRow>;
      officer_certifications: TableDef<OfficerCertificationRow>;
      plans: TableDef<PlanRow>;
      companies: TableDef<CompanyRow>;
      company_members: TableDef<CompanyMemberRow>;
      company_invites: TableDef<CompanyInviteRow>;
      sites: TableDef<SiteRow>;
      platform_settings: TableDef<PlatformSettingRow>;
      user_agreements: TableDef<UserAgreementRow>;
      audit_log: TableDef<AuditLogRow>;
      push_tokens: TableDef<PushTokenRow>;
      notifications: TableDef<NotificationRow>;
      push_queue: TableDef<PushQueueRow>;
      shifts: TableDef<ShiftRow>;
      shift_applications: TableDef<ShiftApplicationRow>;
      assignments: TableDef<AssignmentRow>;
      location_pings: TableDef<LocationPingRow>;
      payments: TableDef<PaymentRow>;
      ratings: TableDef<RatingRow>;
      strikes: TableDef<StrikeRow>;
      disputes: TableDef<DisputeRow>;
      incident_reports: TableDef<IncidentReportRow>;
      message_threads: TableDef<MessageThreadRow>;
      messages: TableDef<MessageRow>;
      saved_shifts: TableDef<SavedShiftRow>;
      stripe_events: TableDef<StripeEventRow>;
      waitlist_leads: TableDef<WaitlistLeadRowDb>;
    };
    Views: {
      officer_public_profiles: { Row: OfficerPublicProfileRow; Relationships: [] };
    };
    Functions: {
      accept_shift: {
        Args: { p_shift_id: string; p_message?: string | null };
        Returns: AcceptShiftResult;
      };
      withdraw_application: { Args: { p_shift_id: string }; Returns: undefined };
      confirm_applicant: { Args: { p_application_id: string }; Returns: AssignmentRow };
      decline_applicant: { Args: { p_application_id: string }; Returns: undefined };
      cancel_assignment_by_officer: {
        Args: { p_assignment_id: string; p_reason?: string | null };
        Returns: { late_cancellation: boolean };
      };
      publish_shift: { Args: { p_shift_id: string }; Returns: ShiftRow };
      cancel_shift: { Args: { p_shift_id: string; p_reason?: string | null }; Returns: ShiftRow };
      shift_cost: { Args: { p_shift_id: string }; Returns: ShiftCost };
      company_usage: { Args: { p_company_id?: string }; Returns: CompanyUsage };
      match_candidates: { Args: { p_shift_id: string }; Returns: MatchCandidate[] };
      clock_in: {
        Args: {
          p_assignment_id: string;
          p_lat: number;
          p_lng: number;
          p_accuracy_m?: number | null;
        };
        Returns: ClockInResult;
      };
      request_clock_in_override: {
        Args: { p_assignment_id: string; p_lat: number; p_lng: number };
        Returns: undefined;
      };
      approve_clock_in_override: { Args: { p_assignment_id: string }; Returns: undefined };
      record_location_ping: {
        Args: {
          p_assignment_id: string;
          p_lat: number;
          p_lng: number;
          p_accuracy_m?: number | null;
        };
        Returns: undefined;
      };
      clock_out: {
        Args: {
          p_assignment_id: string;
          p_lat: number;
          p_lng: number;
          p_accuracy_m?: number | null;
          p_notes?: string | null;
        };
        Returns: ClockOutResult;
      };
      approve_timesheet: {
        Args: { p_assignment_id: string; p_approved_minutes?: number | null };
        Returns: AssignmentRow;
      };
      dispute_timesheet: {
        Args: { p_assignment_id: string; p_reason: string; p_notes?: string | null };
        Returns: DisputeRow;
      };
      admin_resolve_dispute: {
        Args: { p_assignment_id: string; p_resolved_minutes: number; p_notes?: string | null };
        Returns: AssignmentRow;
      };
      rate_assignment: {
        Args: {
          p_assignment_id: string;
          p_stars: number;
          p_tags?: string[];
          p_comment?: string | null;
        };
        Returns: RatingRow;
      };
      file_incident_report: {
        Args: {
          p_assignment_id: string;
          p_type: IncidentType;
          p_description: string;
          p_occurred_at?: string;
          p_lat?: number | null;
          p_lng?: number | null;
          p_photo_paths?: string[];
        };
        Returns: IncidentReportRow;
      };
      officer_blockers: { Args: { p_officer_id?: string }; Returns: string[] };
      admin_review_license: {
        Args: { p_license_id: string; p_approve: boolean; p_reason?: string | null };
        Returns: OfficerLicenseRow;
      };
      admin_set_officer_status: {
        Args: { p_officer_id: string; p_status: OfficerAccountStatus; p_reason?: string | null };
        Returns: OfficerProfileRow;
      };
      admin_set_background_status: {
        Args: {
          p_officer_id: string;
          p_status: BackgroundStatus;
          p_provider?: string;
          p_reference?: string | null;
        };
        Returns: OfficerProfileRow;
      };
      admin_set_company_pilot: {
        Args: { p_company_id: string; p_is_pilot: boolean; p_pilot_ends_at?: string | null };
        Returns: CompanyRow;
      };
      admin_set_company_plan: {
        Args: { p_company_id: string; p_plan_code: PlanCodeEnum };
        Returns: CompanyRow;
      };
      admin_overview: { Args: Record<string, never>; Returns: AdminOverview };
      create_company: {
        Args: {
          p_name: string;
          p_type: CompanyTypeEnum;
          p_phone?: string | null;
          p_billing_email?: string | null;
          p_dba?: string | null;
          p_dps_license_no?: string | null;
        };
        Returns: CompanyRow;
      };
      accept_company_invite: { Args: { p_token: string }; Returns: CompanyRow };
      upsert_officer_profile: {
        Args: {
          p_home_lat: number;
          p_home_lng: number;
          p_home_city: string;
          p_home_zip: string;
          p_travel_radius_mi: number;
          p_is_18_plus: boolean;
          p_is_21_plus: boolean;
        };
        Returns: OfficerProfileRow;
      };
      record_agreement: {
        Args: { p_doc_slug: string; p_version: string; p_ip_hash?: string | null };
        Returns: undefined;
      };
      shift_feed: { Args: { p_only_open?: boolean; p_limit?: number }; Returns: ShiftFeedRow[] };
      company_card: { Args: { p_company_id: string }; Returns: CompanyCard[] };
      geo_to_json: { Args: { p: string }; Returns: GeoJsonPoint | null };
    };
    Enums: {
      app_role: AppRole;
      officer_account_status: OfficerAccountStatus;
      background_status: BackgroundStatus;
      license_status: LicenseStatus;
      company_type: CompanyTypeEnum;
      site_type: SiteTypeEnum;
      subscription_status: SubscriptionStatus;
      plan_code: PlanCodeEnum;
      company_member_role: CompanyMemberRole;
      shift_status: ShiftStatus;
      fill_mode: FillMode;
      application_status: ApplicationStatus;
      assignment_status: AssignmentStatus;
      approval_status: ApprovalStatus;
      payment_status: PaymentStatus;
      rating_direction: RatingDirection;
      strike_type: StrikeType;
      incident_type: IncidentType;
      dispute_status: DisputeStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
