/**
 * Legal document registry. PLACEHOLDERS ONLY: no legal text is written here.
 * Each document has a version; user acceptance is recorded with version + timestamp (Phase 2).
 */
export interface LegalDoc {
  slug: string;
  title: string;
  version: string;
  audience: "everyone" | "officers" | "employers";
  /** Plain-language description of what counsel needs to cover. Not legal text. */
  covers: string[];
}

export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    version: "0.1-draft",
    audience: "everyone",
    covers: [
      "Who may use ShiftShield and account responsibilities",
      "Marketplace role: ShiftShield connects employers and licensed officers and is not the employer of record",
      "Acceptable use, suspension, and termination",
      "Limitation of liability and dispute resolution",
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    version: "0.1-draft",
    audience: "everyone",
    covers: [
      "What we collect (profile, license images, phone, payment status via Stripe)",
      "Location: collected only during an active shift from clock-in to clock-out, never in the background otherwise",
      "How license images are stored (private storage, signed URLs) and who can view them",
      "Retention (location pings deleted after 90 days) and your rights",
    ],
  },
  {
    slug: "contractor-agreement",
    title: "Independent Contractor Agreement",
    version: "0.1-draft",
    audience: "officers",
    covers: [
      "Officer status as an independent contractor",
      "Licensing requirements (Texas DPS Private Security Program) and keeping the license current",
      "Payment terms through Stripe Connect",
      "Conduct, no-show, and cancellation policies",
    ],
  },
  {
    slug: "employer-agreement",
    title: "Employer Subscription Agreement",
    version: "0.1-draft",
    audience: "employers",
    covers: [
      "Subscription tiers, billing, and the platform fee charged on top of officer pay",
      "Payment obligations: shift cost is authorized when an officer is confirmed",
      "Employer conduct obligations toward officers on site",
      "Timesheet approval, disputes, and refunds",
    ],
  },
  {
    slug: "insurance-disclaimer",
    title: "Insurance Disclaimer",
    version: "0.1-draft",
    audience: "everyone",
    covers: [
      "Who carries liability insurance for officers on shift (open question for the client)",
    ],
  },
  {
    slug: "no-guarantee-of-work",
    title: "No Guarantee of Work Notice",
    version: "0.1-draft",
    audience: "officers",
    covers: ["Shift availability depends on employer demand; ShiftShield does not guarantee hours"],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
