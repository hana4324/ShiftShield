import "server-only";
import {
  COMPANY_TYPES,
  COVERAGE_TIMELINES,
  LICENSE_LEVEL_OPTIONS,
  SHIFT_TYPES,
  type WaitlistLeadRow,
} from "@shiftshield/shared";
import { getSupabaseAdmin } from "./supabase-admin";

export interface LeadFilters {
  kind?: "employer" | "officer";
  status?: "new" | "contacted" | "pilot" | "declined";
  q?: string;
}

export interface LeadRow extends WaitlistLeadRow {
  admin_notes: string | null;
  contacted_at: string | null;
}

export async function fetchLeads(
  filters: LeadFilters,
  limit = 500,
): Promise<{ rows: LeadRow[]; configured: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { rows: [], configured: false };

  let query = supabase
    .from("waitlist_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) {
    const q = filters.q.replace(/[%,()]/g, " ").trim();
    if (q) {
      query = query.or(
        `company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`,
      );
    }
  }
  const { data, error } = await query;
  if (error) {
    console.error("[leads] fetch failed", error);
    return { rows: [], configured: true, error: error.message };
  }
  return { rows: (data ?? []) as LeadRow[], configured: true };
}

const labelOf = (list: ReadonlyArray<{ value: string; label: string }>, v: string | null) =>
  v ? (list.find((o) => o.value === v)?.label ?? v) : "";

export function describeLead(row: LeadRow) {
  return {
    companyType: labelOf(COMPANY_TYPES, row.company_type),
    timeline: labelOf(COVERAGE_TIMELINES, row.coverage_timeline),
    license: labelOf(LICENSE_LEVEL_OPTIONS, row.license_level),
    shiftTypes: (row.shift_types ?? []).map((s) => labelOf(SHIFT_TYPES, s)).join(", "),
  };
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = Array.isArray(v) ? v.join("; ") : String(v);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function leadsToCsv(rows: LeadRow[]): string {
  const header = [
    "id",
    "created_at",
    "kind",
    "status",
    "company_name",
    "contact_name",
    "title",
    "email",
    "phone",
    "company_type",
    "city",
    "site_count",
    "shifts_per_month",
    "shift_types",
    "coverage_timeline",
    "license_level",
    "notes",
    "admin_notes",
    "contacted_at",
    "source",
  ] as const;
  const lines = [header.join(",")];
  for (const r of rows) {
    const d = describeLead(r);
    lines.push(
      [
        r.id,
        r.created_at,
        r.kind,
        r.status,
        r.company_name,
        r.contact_name,
        r.title,
        r.email,
        r.phone,
        d.companyType,
        r.city,
        r.site_count,
        r.shifts_per_month,
        d.shiftTypes,
        d.timeline,
        d.license,
        r.notes,
        r.admin_notes,
        r.contacted_at,
        r.source,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM so Excel opens UTF-8 correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
