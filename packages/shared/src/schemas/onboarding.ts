import { z } from "zod";
import { emailSchema, phoneSchema } from "./waitlist";

// ---------- Auth ----------
export const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Use at least 8 characters").max(72),
  full_name: z.string().trim().min(2, "Enter your full legal name").max(120),
  phone: phoneSchema,
  role: z.enum(["officer", "employer_owner"]),
  accepted_terms: z.literal(true, { message: "You must accept the terms" }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

// ---------- Officer onboarding ----------
export const officerProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  home_city: z.string().trim().min(2, "Enter your home city").max(80),
  home_zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP"),
  home_lat: z.number().min(-90).max(90),
  home_lng: z.number().min(-180).max(180),
  travel_radius_mi: z.number().int().min(1).max(200).default(25),
  /** Date of birth is used once to derive the two flags and is never stored. */
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});
export type OfficerProfileInput = z.infer<typeof officerProfileSchema>;

export function ageFlags(
  dateOfBirth: string,
  now = new Date(),
): { is18Plus: boolean; is21Plus: boolean } {
  const [y, m, d] = dateOfBirth.split("-").map(Number) as [number, number, number];
  const birthday = (years: number) => new Date(Date.UTC(y + years, m - 1, d));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { is18Plus: today >= birthday(18).getTime(), is21Plus: today >= birthday(21).getTime() };
}

export const licenseUploadSchema = z.object({
  license_type_code: z.string().min(1, "Choose your license level"),
  license_number: z
    .string()
    .trim()
    .min(4, "Enter the license number")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  front_path: z.string().min(1, "Upload the front of your license"),
  back_path: z.string().min(1, "Upload the back of your license"),
});
export type LicenseUploadInput = z.infer<typeof licenseUploadSchema>;

export const certificationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  issued_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  expires_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  document_path: z.string().optional(),
});

// ---------- Employer onboarding ----------
export const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(160),
  dba: z.string().trim().max(160).optional().or(z.literal("")),
  type: z.enum([
    "security_company",
    "senior_living",
    "apartment",
    "hospital",
    "hotel",
    "construction",
    "corporate",
    "event",
    "retail",
    "other",
  ]),
  phone: phoneSchema,
  billing_email: emailSchema,
  dps_license_no: z.string().trim().max(40).optional().or(z.literal("")),
});
export type CompanyInput = z.infer<typeof companySchema>;

export const siteSchema = z.object({
  name: z.string().trim().min(2, "Name the site").max(160),
  site_type: z.enum([
    "senior_living",
    "hospital",
    "apartment",
    "hotel",
    "construction",
    "corporate",
    "event",
    "retail",
    "other",
  ]),
  address: z.string().trim().min(5, "Pick an address").max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geofence_radius_m: z.number().int().min(25).max(2000).default(150),
  contact_name: z.string().trim().max(120).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(30).optional().or(z.literal("")),
  post_orders: z.string().trim().max(4000).optional().or(z.literal("")),
  photo_path: z.string().optional(),
});
export type SiteInput = z.infer<typeof siteSchema>;

export const inviteManagerSchema = z.object({ email: emailSchema });

// ---------- Shifts ----------
export const shiftRequirementSchema = z.object({
  key: z.string().min(1),
  label: z.string().trim().min(1).max(120),
});

export const shiftPostSchema = z
  .object({
    site_id: z.string().uuid("Choose a site"),
    title: z.string().trim().min(3, "Give the shift a title").max(120),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    /** Local calendar date at the site (YYYY-MM-DD) + HH:MM start/end; overnight resolved server-side helper. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    hourly_rate_cents: z
      .number()
      .int()
      .min(1200, "Rate seems low for a licensed officer")
      .max(50_000),
    officers_needed: z.number().int().min(1).max(100),
    required_license_level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    armed_required: z.boolean(),
    requirements: z.array(shiftRequirementSchema).max(20).default([]),
    fill_mode: z.enum(["review", "auto"]),
    is_urgent: z.boolean().default(false),
  })
  .refine((s) => !s.armed_required || s.required_license_level >= 3, {
    message: "Armed posts need a Level III license",
    path: ["required_license_level"],
  });
export type ShiftPostInput = z.infer<typeof shiftPostSchema>;

export const REQUIREMENT_PRESETS = [
  { key: "own_transportation", label: "Own transportation" },
  { key: "min_age_21", label: "Minimum age 21" },
  { key: "uniform_black", label: "Black uniform (polo + pants)" },
  { key: "uniform_business", label: "Business attire" },
  { key: "radio_provided", label: "Radio / flashlight provided" },
] as const;

// ---------- Shift day ----------
export const incidentReportSchema = z.object({
  assignment_id: z.string().uuid(),
  type: z.enum([
    "medical",
    "theft",
    "trespass",
    "altercation",
    "property_damage",
    "suspicious_activity",
    "fire_safety",
    "other",
  ]),
  description: z.string().trim().min(10, "Describe what happened").max(4000),
  occurred_at: z.string().datetime({ offset: true }),
  lat: z.number().optional(),
  lng: z.number().optional(),
  photo_paths: z.array(z.string()).max(10).default([]),
});
export type IncidentReportInput = z.infer<typeof incidentReportSchema>;

export const RATING_TAGS = ["on_time", "professional", "uniform", "communication"] as const;
export const ratingSchema = z.object({
  assignment_id: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  tags: z.array(z.enum(RATING_TAGS)).default([]),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type RatingInput = z.infer<typeof ratingSchema>;

export const timesheetApprovalSchema = z.object({
  assignment_id: z.string().uuid(),
  approved_minutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .optional(),
});

export const disputeSchema = z.object({
  assignment_id: z.string().uuid(),
  reason: z.string().trim().min(5).max(200),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
