export const SITE_TYPES = [
  { value: "senior_living", label: "Senior Living Community" },
  { value: "hospital", label: "Hospital / Healthcare" },
  { value: "apartment", label: "Apartment Community" },
  { value: "hotel", label: "Hotel" },
  { value: "construction", label: "Construction Site" },
  { value: "corporate", label: "Corporate Office" },
  { value: "event", label: "Event" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
] as const;

export type SiteType = (typeof SITE_TYPES)[number]["value"];

export const COMPANY_TYPES = [
  { value: "security_company", label: "Security company / contractor" },
  { value: "senior_living", label: "Senior living community" },
  { value: "apartment", label: "Apartment / property management" },
  { value: "hospital", label: "Hospital / healthcare" },
  { value: "hotel", label: "Hotel / hospitality" },
  { value: "construction", label: "Construction" },
  { value: "corporate", label: "Corporate property" },
  { value: "event", label: "Events / venue" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number]["value"];

/** Typical shift types for the pilot form checkboxes. */
export const SHIFT_TYPES = [
  { value: "overnight", label: "Overnight / night security" },
  { value: "front_desk", label: "Front desk / lobby" },
  { value: "patrol", label: "Mobile / foot patrol" },
  { value: "access_control", label: "Access control / gate" },
  { value: "event", label: "Event security" },
  { value: "armed", label: "Armed (Level III)" },
  { value: "unarmed", label: "Unarmed (Level II)" },
  { value: "emergency_fill", label: "Emergency / same-day fill" },
] as const;

export type ShiftTypeOption = (typeof SHIFT_TYPES)[number]["value"];

export const COVERAGE_TIMELINES = [
  { value: "immediately", label: "Immediately" },
  { value: "within_2_weeks", label: "Within 2 weeks" },
  { value: "within_month", label: "Within a month" },
  { value: "exploring", label: "Just exploring" },
] as const;

export type CoverageTimeline = (typeof COVERAGE_TIMELINES)[number]["value"];

export const WAITLIST_STATUSES = ["new", "contacted", "pilot", "declined"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];
