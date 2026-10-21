/**
 * Dallas-Fort Worth demo data for Phase 1 (clickable demo). Mirrors the mockup.
 * Dates are generated relative to "now" so the demo always looks current.
 */
import { zonedLocalToInstant } from "@shiftshield/shared/money";
import type { SiteType } from "@shiftshield/shared/constants";
import type { LatLng } from "./geo";

export type Role = "officer" | "employer";
export type FillMode = "review" | "auto";
export type ShiftStatus = "draft" | "open" | "filled" | "in_progress" | "completed" | "cancelled";
export type ApplicationStatus = "applied" | "accepted" | "declined" | "withdrawn";
export type AssignmentStatus = "confirmed" | "clocked_in" | "completed" | "no_show" | "cancelled";
export type LicenseLevel = 2 | 3 | 4;

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  typeLabel: string;
  address: string;
  city: string;
  geo: LatLng;
  geofenceRadiusM: number;
  contactName: string;
  contactPhone: string;
  postOrders: string;
}

export interface ShiftRequirement {
  key: string;
  label: string;
  met: boolean;
}

export interface Shift {
  id: string;
  siteId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  hourlyRateCents: number;
  officersNeeded: number;
  requiredLicenseLevel: LicenseLevel;
  armedRequired: boolean;
  requirements: ShiftRequirement[];
  fillMode: FillMode;
  isUrgent: boolean;
  status: ShiftStatus;
  postedAt: string;
}

export interface OfficerSummary {
  id: string;
  name: string;
  licenseLevel: LicenseLevel;
  ratingAvg: number;
  ratingCount: number;
  completedShifts: number;
  reliabilityPct: number;
  home: LatLng;
  homeCity: string;
}

export interface Application {
  id: string;
  shiftId: string;
  officerId: string;
  status: ApplicationStatus;
  appliedAt: string;
}

export interface Assignment {
  id: string;
  shiftId: string;
  officerId: string;
  status: AssignmentStatus;
  clockInAt?: string;
  clockOutAt?: string;
  approvedMinutes?: number;
  approvalStatus?: "pending" | "approved" | "auto_approved" | "disputed";
  paidCents?: number;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  body: string;
  sentAt: string;
}

export interface Thread {
  id: string;
  shiftId: string;
  title: string;
  participants: string[];
}

export interface VerificationStep {
  key: string;
  label: string;
  status: "done" | "pending" | "action";
  detail?: string;
}

const TZ = "America/Chicago";

/** Returns the ISO instant for a local Chicago time on today + dayOffset. */
function at(dayOffset: number, hhmm: string): string {
  const now = new Date();
  const todayLocal = now.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const [y, m, d] = todayLocal.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1, d + dayOffset));
  const date = target.toISOString().slice(0, 10);
  return zonedLocalToInstant(`${date}T${hhmm}:00`, TZ).toISOString();
}

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Overnight end: same calendar day offset + 1. */
function overnight(
  dayOffset: number,
  start: string,
  end: string,
): { startAt: string; endAt: string } {
  return { startAt: at(dayOffset, start), endAt: at(dayOffset + 1, end) };
}

// ---------- Officer (demo user) ----------
export const DEMO_OFFICER: OfficerSummary = {
  id: "off_marcus",
  name: "Marcus Reed",
  licenseLevel: 3,
  ratingAvg: 4.9,
  ratingCount: 38,
  completedShifts: 42,
  reliabilityPct: 98,
  home: { latitude: 32.8, longitude: -96.8 },
  homeCity: "Dallas, TX",
};

export const DEMO_OFFICER_PROFILE = {
  phone: "(469) 555-0121",
  email: "marcus.reed@example.com",
  travelRadiusMi: 25,
  licenseNumber: "TX-3-0482917",
  licenseExpiresOn: "2027-08-31",
  certifications: ["Level III Commission", "CPR / First Aid"],
  is21Plus: true,
};

export const DEMO_VERIFICATION: VerificationStep[] = [
  { key: "email", label: "Email verified", status: "done" },
  { key: "profile", label: "Profile complete", status: "done" },
  {
    key: "fee",
    label: "$30 signup fee paid",
    status: "done",
    detail: "Covers your background check",
  },
  {
    key: "license",
    label: "Texas DPS license approved",
    status: "done",
    detail: "Level III, expires Aug 31, 2027",
  },
  { key: "background", label: "Background check clear", status: "done" },
  {
    key: "payouts",
    label: "Payout account (Stripe)",
    status: "action",
    detail: "Connect your bank to get paid after your first shift",
  },
];

// ---------- Employer (demo company) ----------
export const DEMO_COMPANY = {
  id: "co_lonestar",
  name: "Lone Star Protective Services",
  plan: "pro" as const,
  planName: "Pro",
  feeBps: 1000,
  bookingsUsed: 11,
  bookingCap: 40,
  shiftsUsed: 9,
  shiftCap: 40,
  managerName: "Derrick Hall",
};

export const DEMO_SITES: Site[] = [
  {
    id: "site_oakridge",
    name: "Oak Ridge Senior Living",
    type: "senior_living",
    typeLabel: "Senior Living Community",
    address: "8200 Walnut Hill Ln, Dallas, TX 75231",
    city: "Dallas",
    geo: { latitude: 32.879, longitude: -96.768 },
    geofenceRadiusM: 150,
    contactName: "Maria Lopez",
    contactPhone: "(214) 555-0142",
    postOrders:
      "Check in at the front desk. Hourly rounds of all three wings and the parking garage. Memory care wing doors must stay secured; residents may not exit without staff. Log every visitor after 9 PM.",
  },
  {
    id: "site_baylor",
    name: "Methodist Central Hospital",
    type: "hospital",
    typeLabel: "Hospital",
    address: "3500 Gaston Ave, Dallas, TX 75246",
    city: "Dallas",
    geo: { latitude: 32.789, longitude: -96.78 },
    geofenceRadiusM: 200,
    contactName: "Charge Nurse, ER",
    contactPhone: "(214) 555-0177",
    postOrders:
      "Front desk and ER entrance. Screen visitors, issue badges, de-escalate and call 911 for any threat. Escort staff to the garage on request.",
  },
  {
    id: "site_arlington",
    name: "Arlington Expo Center",
    type: "event",
    typeLabel: "Event",
    address: "1201 E Division St, Arlington, TX 76011",
    city: "Arlington",
    geo: { latitude: 32.747, longitude: -97.085 },
    geofenceRadiusM: 250,
    contactName: "Event Ops, Gate B",
    contactPhone: "(817) 555-0188",
    postOrders:
      "Bag checks at Gate B, crowd control at the main floor. Radio check on arrival. No re-entry after 11 PM.",
  },
  {
    id: "site_addison",
    name: "Addison Tower",
    type: "corporate",
    typeLabel: "Corporate Office Building",
    address: "15601 Dallas Pkwy, Addison, TX 75001",
    city: "Addison",
    geo: { latitude: 32.961, longitude: -96.83 },
    geofenceRadiusM: 150,
    contactName: "Priya Natarajan",
    contactPhone: "(972) 555-0107",
    postOrders:
      "Lobby desk. Lock down after 8 PM, badge access only. Patrol floors 2-14 every two hours. Report any propped doors.",
  },
  {
    id: "site_plano",
    name: "Legacy West Retail Center",
    type: "retail",
    typeLabel: "Retail",
    address: "7500 Windrose Ave, Plano, TX 75024",
    city: "Plano",
    geo: { latitude: 33.079, longitude: -96.823 },
    geofenceRadiusM: 200,
    contactName: "Property Management",
    contactPhone: "(972) 555-0150",
    postOrders:
      "Weekend foot patrol of the promenade and garages. Assist loss prevention when requested.",
  },
];

const night = overnight(0, "22:00", "06:00");
const hospital = overnight(0, "18:00", "02:00");
const event = overnight(1, "17:00", "01:00");
const addison = overnight(0, "19:00", "03:00");
const plano = { startAt: at(5, "10:00"), endAt: at(5, "18:00") };
const completedA = overnight(-2, "22:00", "06:00");
const completedB = overnight(-4, "18:00", "02:00");
const completedC = overnight(-6, "22:00", "06:00");

export const DEMO_SHIFTS: Shift[] = [
  {
    id: "shift_oakridge_night",
    siteId: "site_oakridge",
    title: "Night Security",
    description:
      "Overnight unarmed officer for a 120-resident senior living community. Friendly, calm presence with residents and families; firm on access control. Uniform: black polo and tactical pants.",
    ...night,
    hourlyRateCents: 2600,
    officersNeeded: 1,
    requiredLicenseLevel: 2,
    armedRequired: false,
    requirements: [
      { key: "license", label: "Level II license or higher", met: true },
      { key: "uniform", label: "Black polo, black pants", met: true },
      { key: "transport", label: "Own transportation", met: true },
      { key: "age", label: "Minimum age 21", met: true },
    ],
    fillMode: "auto",
    isUrgent: false,
    status: "open",
    postedAt: ago(12),
  },
  {
    id: "shift_hospital_desk",
    siteId: "site_baylor",
    title: "Front Desk Officer",
    description:
      "ER front desk coverage. Visitor screening and badge issuance. De-escalation experience preferred. Hospital will provide a radio.",
    ...hospital,
    hourlyRateCents: 2800,
    officersNeeded: 2,
    requiredLicenseLevel: 2,
    armedRequired: false,
    requirements: [
      { key: "license", label: "Level II license or higher", met: true },
      { key: "uniform", label: "White shirt, black pants", met: true },
      { key: "transport", label: "Own transportation", met: true },
    ],
    fillMode: "review",
    isUrgent: true,
    status: "open",
    postedAt: ago(41),
  },
  {
    id: "shift_arlington_event",
    siteId: "site_arlington",
    title: "Event Security",
    description:
      "Concert at the Expo Center, 6,000 attendees. Gate bag checks and floor crowd control. Must be comfortable on your feet for the full shift.",
    ...event,
    hourlyRateCents: 2400,
    officersNeeded: 6,
    requiredLicenseLevel: 2,
    armedRequired: false,
    requirements: [
      { key: "license", label: "Level II license or higher", met: true },
      { key: "uniform", label: "Hi-vis vest provided", met: true },
      { key: "age", label: "Minimum age 21", met: true },
    ],
    fillMode: "auto",
    isUrgent: false,
    status: "open",
    postedAt: ago(130),
  },
  {
    id: "shift_addison_corp",
    siteId: "site_addison",
    title: "Corporate Office Building",
    description:
      "Armed lobby officer for a Class A office tower. Lock-down at 8 PM, floor patrols every two hours. Professional appearance required.",
    ...addison,
    hourlyRateCents: 3000,
    officersNeeded: 1,
    requiredLicenseLevel: 3,
    armedRequired: true,
    requirements: [
      { key: "license", label: "Level III (commissioned) license", met: true },
      { key: "uniform", label: "Suit or blazer, duty belt", met: true },
      { key: "transport", label: "Own transportation", met: true },
      { key: "age", label: "Minimum age 21", met: true },
    ],
    fillMode: "review",
    isUrgent: false,
    status: "open",
    postedAt: ago(200),
  },
  {
    id: "shift_plano_weekend",
    siteId: "site_plano",
    title: "Weekend Security",
    description: "Saturday daytime foot patrol at an outdoor retail promenade.",
    ...plano,
    hourlyRateCents: 2500,
    officersNeeded: 2,
    requiredLicenseLevel: 2,
    armedRequired: false,
    requirements: [
      { key: "license", label: "Level II license or higher", met: true },
      { key: "uniform", label: "Black polo, khakis", met: true },
    ],
    fillMode: "auto",
    isUrgent: false,
    status: "draft",
    postedAt: ago(1440),
  },
  // Completed history for the officer's earnings
  {
    id: "shift_done_a",
    siteId: "site_oakridge",
    title: "Night Security",
    description: "",
    ...completedA,
    hourlyRateCents: 2600,
    officersNeeded: 1,
    requiredLicenseLevel: 2,
    armedRequired: false,
    requirements: [],
    fillMode: "auto",
    isUrgent: false,
    status: "completed",
    postedAt: ago(4000),
  },
  {
    id: "shift_done_b",
    siteId: "site_baylor",
    title: "Front Desk Officer",
    description: "",
    ...completedB,
    hourlyRateCents: 2800,
    officersNeeded: 2,
    requiredLicenseLevel: 2,
    armedRequired: false,
    requirements: [],
    fillMode: "review",
    isUrgent: false,
    status: "completed",
    postedAt: ago(7000),
  },
  {
    id: "shift_done_c",
    siteId: "site_addison",
    title: "Corporate Office Building",
    description: "",
    ...completedC,
    hourlyRateCents: 3000,
    officersNeeded: 1,
    requiredLicenseLevel: 3,
    armedRequired: true,
    requirements: [],
    fillMode: "review",
    isUrgent: false,
    status: "completed",
    postedAt: ago(10000),
  },
];

/** Other officers who appear as applicants / booked officers in the employer demo. */
export const DEMO_OFFICERS: OfficerSummary[] = [
  DEMO_OFFICER,
  {
    id: "off_jwhit",
    name: "James Whitfield",
    licenseLevel: 3,
    ratingAvg: 4.8,
    ratingCount: 61,
    completedShifts: 73,
    reliabilityPct: 97,
    home: { latitude: 32.735, longitude: -97.108 },
    homeCity: "Arlington, TX",
  },
  {
    id: "off_tgarcia",
    name: "Tasha Garcia",
    licenseLevel: 2,
    ratingAvg: 4.7,
    ratingCount: 22,
    completedShifts: 25,
    reliabilityPct: 96,
    home: { latitude: 32.82, longitude: -96.75 },
    homeCity: "Dallas, TX",
  },
  {
    id: "off_dokafor",
    name: "Daniel Okafor",
    licenseLevel: 2,
    ratingAvg: 5.0,
    ratingCount: 9,
    completedShifts: 11,
    reliabilityPct: 100,
    home: { latitude: 32.91, longitude: -96.9 },
    homeCity: "Carrollton, TX",
  },
  {
    id: "off_rnguyen",
    name: "Rachel Nguyen",
    licenseLevel: 3,
    ratingAvg: 4.6,
    ratingCount: 44,
    completedShifts: 50,
    reliabilityPct: 94,
    home: { latitude: 32.95, longitude: -96.73 },
    homeCity: "Richardson, TX",
  },
  {
    id: "off_cbrooks",
    name: "Chris Brooks",
    licenseLevel: 2,
    ratingAvg: 4.4,
    ratingCount: 15,
    completedShifts: 18,
    reliabilityPct: 89,
    home: { latitude: 32.69, longitude: -97.12 },
    homeCity: "Fort Worth, TX",
  },
];

export const DEMO_APPLICATIONS: Application[] = [
  {
    id: "app_1",
    shiftId: "shift_hospital_desk",
    officerId: "off_tgarcia",
    status: "applied",
    appliedAt: ago(35),
  },
  {
    id: "app_2",
    shiftId: "shift_hospital_desk",
    officerId: "off_dokafor",
    status: "applied",
    appliedAt: ago(28),
  },
  {
    id: "app_3",
    shiftId: "shift_hospital_desk",
    officerId: "off_cbrooks",
    status: "applied",
    appliedAt: ago(9),
  },
  {
    id: "app_4",
    shiftId: "shift_addison_corp",
    officerId: "off_rnguyen",
    status: "applied",
    appliedAt: ago(90),
  },
  {
    id: "app_5",
    shiftId: "shift_addison_corp",
    officerId: "off_jwhit",
    status: "applied",
    appliedAt: ago(60),
  },
];

export const DEMO_ASSIGNMENTS: Assignment[] = [
  // Live on-shift officer for the employer's live map (clocked in at the hospital).
  {
    id: "asg_live",
    shiftId: "shift_hospital_desk",
    officerId: "off_jwhit",
    status: "clocked_in",
    clockInAt: ago(95),
  },
  // Event shift partially filled
  {
    id: "asg_ev1",
    shiftId: "shift_arlington_event",
    officerId: "off_tgarcia",
    status: "confirmed",
  },
  {
    id: "asg_ev2",
    shiftId: "shift_arlington_event",
    officerId: "off_cbrooks",
    status: "confirmed",
  },
  // Marcus's completed week
  {
    id: "asg_done_a",
    shiftId: "shift_done_a",
    officerId: "off_marcus",
    status: "completed",
    approvedMinutes: 480,
    approvalStatus: "approved",
    paidCents: 20800,
  },
  {
    id: "asg_done_b",
    shiftId: "shift_done_b",
    officerId: "off_marcus",
    status: "completed",
    approvedMinutes: 480,
    approvalStatus: "approved",
    paidCents: 22400,
  },
  {
    id: "asg_done_c",
    shiftId: "shift_done_c",
    officerId: "off_marcus",
    status: "completed",
    approvedMinutes: 450,
    approvalStatus: "auto_approved",
    paidCents: 22500,
  },
];

export const DEMO_THREADS: Thread[] = [
  {
    id: "thr_hospital",
    shiftId: "shift_hospital_desk",
    title: "Front Desk Officer - Methodist Central",
    participants: ["co_lonestar", "off_jwhit", "off_marcus"],
  },
  {
    id: "thr_event",
    shiftId: "shift_arlington_event",
    title: "Event Security - Arlington Expo",
    participants: ["co_lonestar", "off_tgarcia", "off_cbrooks"],
  },
];

export const DEMO_MESSAGES: Message[] = [
  {
    id: "m1",
    threadId: "thr_hospital",
    senderId: "co_lonestar",
    senderName: "Derrick Hall",
    body: "Welcome aboard. Park in Garage C, level 2. Badge pickup at the ER desk.",
    sentAt: ago(140),
  },
  {
    id: "m2",
    threadId: "thr_hospital",
    senderId: "off_jwhit",
    senderName: "James Whitfield",
    body: "Copy. On site and clocked in. Radio check complete.",
    sentAt: ago(94),
  },
  {
    id: "m3",
    threadId: "thr_hospital",
    senderId: "co_lonestar",
    senderName: "Derrick Hall",
    body: "Great. Charge nurse is Kim tonight, she knows you're coming.",
    sentAt: ago(90),
  },
  {
    id: "m4",
    threadId: "thr_event",
    senderId: "co_lonestar",
    senderName: "Derrick Hall",
    body: "Doors open at 5. Be at Gate B by 4:30 for the briefing. Vests are in the ops trailer.",
    sentAt: ago(300),
  },
  {
    id: "m5",
    threadId: "thr_event",
    senderId: "off_tgarcia",
    senderName: "Tasha Garcia",
    body: "Got it, see you there.",
    sentAt: ago(280),
  },
];

export const DEMO_NOTIFICATIONS = [
  {
    id: "n1",
    title: "Urgent shift nearby",
    body: "Front Desk Officer at Methodist Central, $28/hr, starts tonight.",
    at: ago(41),
  },
  {
    id: "n2",
    title: "Timesheet approved",
    body: "Addison Tower: 7h 30m approved. $225.00 is on its way.",
    at: ago(900),
  },
  {
    id: "n3",
    title: "License reminder",
    body: "Your Level III license expires in 10 months. No action needed yet.",
    at: ago(2000),
  },
];
