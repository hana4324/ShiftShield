import { z } from "zod";
import {
  COMPANY_TYPES,
  COVERAGE_TIMELINES,
  SHIFT_TYPES,
  WAITLIST_STATUSES,
} from "../constants/site-types";
import { LICENSE_LEVEL_OPTIONS } from "../constants/licenses";

const companyTypeValues = COMPANY_TYPES.map((c) => c.value) as [string, ...string[]];
const shiftTypeValues = SHIFT_TYPES.map((s) => s.value) as [string, ...string[]];
const coverageValues = COVERAGE_TIMELINES.map((c) => c.value) as [string, ...string[]];
const licenseLevelValues = LICENSE_LEVEL_OPTIONS.map((l) => l.value) as [string, ...string[]];

/** Loose US phone validation: 10 digits after stripping formatting, optional leading 1. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a phone number")
  .max(30)
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
  }, "Enter a valid US phone number");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(254);

const name = z.string().trim().min(2, "Too short").max(120);
const shortText = z.string().trim().max(120);
const notes = z.string().trim().max(2000).optional().or(z.literal(""));

/** Fields shared by both forms. Honeypot + timing are anti-spam signals checked server-side. */
export const antiSpamSchema = z.object({
  /** Honeypot: must be empty. Named innocuously so bots fill it. */
  website: z.string().max(0, "Spam detected").optional().or(z.literal("")),
  /**
   * Epoch ms when the form rendered; submissions faster than a few seconds are rejected.
   * An empty string (hidden input never populated, or cleared by a form reset) is treated as
   * absent so it can never block a real submission on a field the user cannot see.
   */
  started_at: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
});

export const employerLeadSchema = antiSpamSchema.extend({
  kind: z.literal("employer"),
  company_name: name,
  contact_name: name,
  title: shortText.optional().or(z.literal("")),
  email: emailSchema,
  phone: phoneSchema,
  company_type: z.enum(companyTypeValues, { message: "Choose a company type" }),
  city: shortText.min(2, "Enter a city"),
  site_count: z.coerce.number().int().min(1, "At least 1").max(10_000),
  shifts_per_month: z.coerce.number().int().min(0).max(100_000),
  shift_types: z.array(z.enum(shiftTypeValues)).max(SHIFT_TYPES.length).default([]),
  coverage_timeline: z.enum(coverageValues, { message: "Pick a timeline" }),
  notes,
});

export const officerLeadSchema = antiSpamSchema.extend({
  kind: z.literal("officer"),
  contact_name: name,
  email: emailSchema,
  phone: phoneSchema,
  city: shortText.min(2, "Enter a city"),
  license_level: z.enum(licenseLevelValues, { message: "Choose a license level" }),
});

export const waitlistLeadSchema = z.discriminatedUnion("kind", [
  employerLeadSchema,
  officerLeadSchema,
]);

export type EmployerLeadInput = z.infer<typeof employerLeadSchema>;
export type OfficerLeadInput = z.infer<typeof officerLeadSchema>;
export type WaitlistLeadInput = z.infer<typeof waitlistLeadSchema>;

export const waitlistStatusSchema = z.enum(WAITLIST_STATUSES);

/** Shape of a `waitlist_leads` row as returned by Supabase (Phase 0 subset). */
export interface WaitlistLeadRow {
  id: string;
  kind: "employer" | "officer";
  status: (typeof WAITLIST_STATUSES)[number];
  company_name: string | null;
  contact_name: string;
  title: string | null;
  email: string;
  phone: string;
  company_type: string | null;
  city: string;
  site_count: number | null;
  shifts_per_month: number | null;
  shift_types: string[] | null;
  coverage_timeline: string | null;
  license_level: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert a FormData into a plain object the zod schemas accept.
 * Repeated keys (checkboxes) become arrays when `arrayKeys` lists them.
 */
export function formDataToObject(
  formData: FormData,
  arrayKeys: readonly string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of arrayKeys) {
    out[key] = formData.getAll(key).map(String);
  }
  for (const [key, value] of formData.entries()) {
    if (arrayKeys.includes(key)) continue;
    out[key] = typeof value === "string" ? value : "";
  }
  return out;
}
