import { create } from "zustand";
import { computeShiftCost } from "@shiftshield/shared/money";
import {
  DEMO_APPLICATIONS,
  DEMO_ASSIGNMENTS,
  DEMO_COMPANY,
  DEMO_MESSAGES,
  DEMO_OFFICER,
  DEMO_OFFICERS,
  DEMO_SHIFTS,
  DEMO_SITES,
  DEMO_THREADS,
  type Application,
  type Assignment,
  type Message,
  type Role,
  type Shift,
  type Site,
  type Thread,
} from "@/lib/demo-data";
import { distanceMiles } from "@/lib/geo";

let seq = 100;
const nextId = (prefix: string) => `${prefix}_${++seq}`;

export interface ShiftDraft {
  siteId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  hourlyRateCents: number;
  officersNeeded: number;
  requiredLicenseLevel: 2 | 3 | 4;
  armedRequired: boolean;
  requirementLabels: string[];
  fillMode: "review" | "auto";
  isUrgent: boolean;
}

interface DemoState {
  role: Role | null;
  isAvailable: boolean;
  sites: Site[];
  shifts: Shift[];
  applications: Application[];
  assignments: Assignment[];
  bookmarks: string[];
  threads: Thread[];
  messages: Message[];
  payoutsEnabled: boolean;
  selectedSiteFilter: string | null;

  setRole: (role: Role | null) => void;
  toggleAvailable: () => void;
  toggleBookmark: (shiftId: string) => void;
  /** Officer taps Accept. Returns the outcome so the UI can explain. */
  acceptShift: (shiftId: string) => "booked" | "applied" | "full" | "already" | "blocked";
  withdraw: (shiftId: string) => void;
  clockIn: (assignmentId: string) => void;
  clockOut: (assignmentId: string) => void;
  confirmApplicant: (applicationId: string) => "confirmed" | "full";
  declineApplicant: (applicationId: string) => void;
  saveShift: (draft: ShiftDraft, publish: boolean) => string;
  publishDraft: (shiftId: string) => void;
  cancelShift: (shiftId: string) => void;
  sendMessage: (threadId: string, body: string) => void;
  connectPayouts: () => void;
  setSiteFilter: (siteId: string | null) => void;
  resetDemo: () => void;
}

const initial = () => ({
  role: null as Role | null,
  isAvailable: true,
  sites: DEMO_SITES,
  shifts: DEMO_SHIFTS,
  applications: DEMO_APPLICATIONS,
  assignments: DEMO_ASSIGNMENTS,
  bookmarks: ["shift_addison_corp"],
  threads: DEMO_THREADS,
  messages: DEMO_MESSAGES,
  payoutsEnabled: false,
  selectedSiteFilter: null as string | null,
});

export const useDemoStore = create<DemoState>((set, get) => ({
  ...initial(),

  setRole: (role) => set({ role }),
  toggleAvailable: () => set((s) => ({ isAvailable: !s.isAvailable })),
  toggleBookmark: (shiftId) =>
    set((s) => ({
      bookmarks: s.bookmarks.includes(shiftId)
        ? s.bookmarks.filter((id) => id !== shiftId)
        : [...s.bookmarks, shiftId],
    })),

  acceptShift: (shiftId) => {
    const s = get();
    const shift = s.shifts.find((x) => x.id === shiftId);
    if (!shift || shift.status !== "open") return "blocked";
    if (DEMO_OFFICER.licenseLevel < shift.requiredLicenseLevel) return "blocked";
    const mine = s.assignments.find(
      (a) => a.shiftId === shiftId && a.officerId === DEMO_OFFICER.id && a.status !== "cancelled",
    );
    const applied = s.applications.find(
      (a) => a.shiftId === shiftId && a.officerId === DEMO_OFFICER.id && a.status === "applied",
    );
    if (mine || applied) return "already";
    const booked = s.assignments.filter(
      (a) => a.shiftId === shiftId && a.status !== "cancelled" && a.status !== "no_show",
    ).length;
    if (booked >= shift.officersNeeded) return "full";

    if (shift.fillMode === "auto") {
      // In production this is a Postgres function with a row lock (no double booking / overfilling).
      const assignment: Assignment = {
        id: nextId("asg"),
        shiftId,
        officerId: DEMO_OFFICER.id,
        status: "confirmed",
      };
      const nowBooked = booked + 1;
      set({
        assignments: [...s.assignments, assignment],
        shifts: s.shifts.map((x) =>
          x.id === shiftId && nowBooked >= x.officersNeeded ? { ...x, status: "filled" } : x,
        ),
      });
      return "booked";
    }
    const application: Application = {
      id: nextId("app"),
      shiftId,
      officerId: DEMO_OFFICER.id,
      status: "applied",
      appliedAt: new Date().toISOString(),
    };
    set({ applications: [...s.applications, application] });
    return "applied";
  },

  withdraw: (shiftId) =>
    set((s) => ({
      applications: s.applications.map((a) =>
        a.shiftId === shiftId && a.officerId === DEMO_OFFICER.id && a.status === "applied"
          ? { ...a, status: "withdrawn" }
          : a,
      ),
    })),

  clockIn: (assignmentId) =>
    set((s) => ({
      assignments: s.assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, status: "clocked_in", clockInAt: new Date().toISOString() }
          : a,
      ),
      shifts: s.shifts.map((x) => {
        const a = s.assignments.find((y) => y.id === assignmentId);
        return a && x.id === a.shiftId ? { ...x, status: "in_progress" } : x;
      }),
    })),

  clockOut: (assignmentId) =>
    set((s) => ({
      assignments: s.assignments.map((a) =>
        a.id === assignmentId
          ? {
              ...a,
              status: "completed",
              clockOutAt: new Date().toISOString(),
              approvalStatus: "pending",
            }
          : a,
      ),
    })),

  confirmApplicant: (applicationId) => {
    const s = get();
    const app = s.applications.find((a) => a.id === applicationId);
    if (!app) return "full";
    const shift = s.shifts.find((x) => x.id === app.shiftId);
    if (!shift) return "full";
    const booked = s.assignments.filter(
      (a) => a.shiftId === shift.id && a.status !== "cancelled" && a.status !== "no_show",
    ).length;
    if (booked >= shift.officersNeeded) return "full";
    const assignment: Assignment = {
      id: nextId("asg"),
      shiftId: shift.id,
      officerId: app.officerId,
      status: "confirmed",
    };
    const nowBooked = booked + 1;
    set({
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, status: "accepted" } : a,
      ),
      assignments: [...s.assignments, assignment],
      shifts: s.shifts.map((x) =>
        x.id === shift.id && nowBooked >= x.officersNeeded ? { ...x, status: "filled" } : x,
      ),
    });
    return "confirmed";
  },

  declineApplicant: (applicationId) =>
    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, status: "declined" } : a,
      ),
    })),

  saveShift: (draft, publish) => {
    const id = nextId("shift");
    const shift: Shift = {
      id,
      siteId: draft.siteId,
      title: draft.title,
      description: draft.description,
      startAt: draft.startAt,
      endAt: draft.endAt,
      hourlyRateCents: draft.hourlyRateCents,
      officersNeeded: draft.officersNeeded,
      requiredLicenseLevel: draft.requiredLicenseLevel,
      armedRequired: draft.armedRequired,
      requirements: draft.requirementLabels.map((label, i) => ({
        key: `req_${i}`,
        label,
        met: true,
      })),
      fillMode: draft.fillMode,
      isUrgent: draft.isUrgent,
      status: publish ? "open" : "draft",
      postedAt: new Date().toISOString(),
    };
    set((s) => ({ shifts: [shift, ...s.shifts] }));
    return id;
  },

  publishDraft: (shiftId) =>
    set((s) => ({
      shifts: s.shifts.map((x) =>
        x.id === shiftId && x.status === "draft"
          ? { ...x, status: "open", postedAt: new Date().toISOString() }
          : x,
      ),
    })),

  cancelShift: (shiftId) =>
    set((s) => ({
      shifts: s.shifts.map((x) => (x.id === shiftId ? { ...x, status: "cancelled" } : x)),
    })),

  sendMessage: (threadId, body) => {
    const s = get();
    const me =
      s.role === "employer"
        ? { id: DEMO_COMPANY.id, name: DEMO_COMPANY.managerName }
        : { id: DEMO_OFFICER.id, name: DEMO_OFFICER.name };
    const msg: Message = {
      id: nextId("msg"),
      threadId,
      senderId: me.id,
      senderName: me.name,
      body,
      sentAt: new Date().toISOString(),
    };
    set({ messages: [...s.messages, msg] });
  },

  connectPayouts: () => set({ payoutsEnabled: true }),
  setSiteFilter: (siteId) => set({ selectedSiteFilter: siteId }),
  resetDemo: () => set({ ...initial(), role: get().role }),
}));

// ---------- Derived helpers (pure, take state slices) ----------

export function siteOf(sites: Site[], siteId: string): Site {
  return sites.find((s) => s.id === siteId) ?? sites[0]!;
}

export function officerOf(officerId: string) {
  return DEMO_OFFICERS.find((o) => o.id === officerId) ?? DEMO_OFFICER;
}

export function bookedCount(assignments: Assignment[], shiftId: string): number {
  return assignments.filter(
    (a) => a.shiftId === shiftId && a.status !== "cancelled" && a.status !== "no_show",
  ).length;
}

export function distanceToSite(site: Site): number {
  return distanceMiles(DEMO_OFFICER.home, site.geo);
}

export function shiftCost(
  shift: Pick<Shift, "hourlyRateCents" | "startAt" | "endAt" | "officersNeeded">,
) {
  const minutes = Math.round(
    (new Date(shift.endAt).getTime() - new Date(shift.startAt).getTime()) / 60_000,
  );
  return computeShiftCost({
    hourlyRateCents: shift.hourlyRateCents,
    minutes,
    feeBps: DEMO_COMPANY.feeBps,
    officersNeeded: shift.officersNeeded,
  });
}

/** Officer's relationship to a shift. */
export function myStatusFor(
  state: Pick<DemoState, "assignments" | "applications">,
  shiftId: string,
) {
  const a = state.assignments.find(
    (x) => x.shiftId === shiftId && x.officerId === DEMO_OFFICER.id && x.status !== "cancelled",
  );
  if (a) return { kind: "assignment" as const, assignment: a };
  const app = state.applications.find(
    (x) => x.shiftId === shiftId && x.officerId === DEMO_OFFICER.id && x.status === "applied",
  );
  if (app) return { kind: "applied" as const, application: app };
  return { kind: "none" as const };
}

/** Open shifts the officer can see: open, within travel radius, not already booked, sorted by distance. */
export function nearbyOpenShifts(
  state: Pick<DemoState, "shifts" | "sites" | "assignments" | "applications">,
) {
  return state.shifts
    .filter((s) => s.status === "open")
    .map((s) => ({
      shift: s,
      site: siteOf(state.sites, s.siteId),
      distanceMi: distanceToSite(siteOf(state.sites, s.siteId)),
    }))
    .filter((x) => x.distanceMi <= 25)
    .sort((a, b) => a.distanceMi - b.distanceMi);
}
