import { isAdminSession } from "@/lib/admin-auth";
import { fetchLeads, leadsToCsv, type LeadFilters } from "@/lib/leads";

/** CSV export of waitlist leads. Route handlers are not covered by the layout gate, so re-check here. */
export async function GET(request: Request) {
  if (!(await isAdminSession())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status");
  const filters: LeadFilters = {
    kind: kind === "employer" || kind === "officer" ? kind : undefined,
    status:
      status === "new" || status === "contacted" || status === "pilot" || status === "declined"
        ? status
        : undefined,
    q: url.searchParams.get("q")?.slice(0, 80) || undefined,
  };
  const { rows, configured, error } = await fetchLeads(filters, 5000);
  if (!configured) return new Response("Supabase not configured", { status: 503 });
  if (error) return new Response(`Export failed: ${error}`, { status: 500 });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(leadsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shiftshield-leads-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
