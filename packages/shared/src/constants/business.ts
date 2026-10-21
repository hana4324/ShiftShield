/** Official ShiftShield business contact. Used in footers, legal pages, Contact screen, and Stripe metadata. */
export const BUSINESS = {
  legalName: "ShiftShield",
  tagline: "Coverage when you need it.",
  secondaryLine: "Verified. Trusted. Protected.",
  positioning: "The On-Demand Security Staffing Platform",
  address: {
    line1: "3500 Oaklawn Ave. #460 PMB 5181",
    city: "Dallas",
    state: "TX",
    zip: "75219",
    full: "3500 Oaklawn Ave. #460 PMB 5181, Dallas, TX 75219",
  },
  phone: "(254) 276-4393",
  phoneE164: "+12542764393",
  launchMarket: "Dallas-Fort Worth, Texas",
  timeZone: "America/Chicago",
} as const;

/** Texas DPS Private Security Program license lookup (used by admin license review). */
export const TX_DPS_LICENSE_LOOKUP_URL =
  "https://www.tops.portal.texas.gov/psp-self-service/search";
