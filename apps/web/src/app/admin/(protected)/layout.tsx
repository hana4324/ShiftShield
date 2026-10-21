import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { logoutAdmin } from "@/app/actions/admin";
import { BrandLogo } from "@/components/brand/logo";
import { SessionRefresh } from "@/components/admin/session-refresh";
import { SidebarNav, type NavItem } from "@/components/admin/sidebar-nav";
import { getAdminSession } from "@/lib/admin-auth";
import { fetchNavCounts } from "@/lib/admin/queries";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | ShiftShield Admin" },
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/licenses", label: "License review" },
  { href: "/admin/officers", label: "Officers" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/shifts", label: "Shifts" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/incidents", label: "Incidents" },
  { href: "/admin/leads", label: "Waitlist leads" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit log" },
];

/** Nav with live badge counts. Reads the session (cookies), so it streams in behind Suspense. */
async function NavWithCounts() {
  const state = await getAdminSession();
  const counts =
    state.status === "ok" && state.session.db ? await fetchNavCounts(state.session.db) : null;
  const items = NAV.map((n) =>
    n.href === "/admin/licenses"
      ? { ...n, count: counts?.licensesPending ?? null }
      : n.href === "/admin/disputes"
        ? { ...n, count: counts?.openDisputes ?? null }
        : n,
  );
  return <SidebarNav items={items} />;
}

async function Gate({ children }: { children: ReactNode }) {
  const state = await getAdminSession();
  if (state.status === "expired") return <SessionRefresh expired />;
  if (state.status !== "ok") redirect("/admin/login");
  const s = state.session;
  return (
    <>
      {s.kind === "supabase" ? <SessionRefresh expiresAt={s.expiresAt} /> : null}
      {children}
    </>
  );
}

async function WhoAmI() {
  const state = await getAdminSession();
  if (state.status !== "ok") return null;
  const s = state.session;
  return (
    <p className="hidden truncate text-xs text-steel-400 lg:block" title={s.kind === "supabase" ? (s.email ?? "") : ""}>
      {s.kind === "supabase" ? (s.email ?? "Admin") : "Local demo mode"}
    </p>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-navy-950/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-navy-950/10" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50 lg:flex-row">
      <aside className="flex flex-col gap-3 bg-navy-950 px-4 py-3 text-white lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:px-5 lg:py-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="rounded-md focus-ring">
            <BrandLogo height={28} />
          </Link>
          <form action={logoutAdmin} className="lg:hidden">
            <button
              type="submit"
              className="touch-target rounded-lg px-3 text-sm font-medium text-steel-400 focus-ring hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
        <Suspense fallback={<SidebarNav items={NAV} />}>
          <NavWithCounts />
        </Suspense>
        <div className="hidden lg:mt-auto lg:block">
          <Suspense fallback={null}>
            <WhoAmI />
          </Suspense>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="touch-target rounded-lg px-3 text-sm font-medium text-steel-400 focus-ring hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <Suspense fallback={<Skeleton />}>
          <Gate>{children}</Gate>
        </Suspense>
      </div>
    </div>
  );
}
