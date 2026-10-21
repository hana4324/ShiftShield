/**
 * Security officer license types, keyed by state so other states can be added later.
 * Seeded into the `license_types` table; the app reads from the DB, this is the canonical default.
 *
 * Texas officers are licensed through the Texas DPS Private Security Program (the "guard card").
 */
export interface LicenseTypeSeed {
  state: "TX";
  code: string;
  name: string;
  level: number;
  armed: boolean;
  description: string;
}

export const LICENSE_TYPES: readonly LicenseTypeSeed[] = [
  {
    state: "TX",
    code: "TX_L2",
    name: "Level II: Non-Commissioned Security Officer",
    level: 2,
    armed: false,
    description: "Unarmed security officer.",
  },
  {
    state: "TX",
    code: "TX_L3",
    name: "Level III: Commissioned Security Officer",
    level: 3,
    armed: true,
    description: "Armed security officer (commissioned).",
  },
  {
    state: "TX",
    code: "TX_L4",
    name: "Level IV: Personal Protection Officer",
    level: 4,
    armed: true,
    description: "Personal protection officer (requires Level III).",
  },
];

export const LICENSE_LEVEL_OPTIONS = [
  { value: "level_2", label: "Level II (Non-Commissioned, unarmed)" },
  { value: "level_3", label: "Level III (Commissioned, armed)" },
  { value: "level_4", label: "Level IV (Personal Protection Officer)" },
  { value: "none_yet", label: "Not licensed yet / in training" },
] as const;

export type LicenseLevelOption = (typeof LICENSE_LEVEL_OPTIONS)[number]["value"];
