import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { logoutAdmin } from "@/app/actions/admin";
import { BrandLogo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { getAdminSession } from "@/lib/admin-auth";
import { adminAuthMode, isAdminConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

async function Gate({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/admin") ? next : "/admin";
  const state = await getAdminSession();
  if (state.status === "ok") redirect(target);
  if (state.status === "forbidden") {
    return (
      <div className="mt-6 space-y-4">
        <p role="alert" className="rounded-xl bg-status-red/10 px-4 py-3 text-sm text-status-red">
          This account is not an admin{state.email ? ` (${state.email})` : ""}.
        </p>
        <form action={logoutAdmin}>
          <button type="submit" className={buttonClasses("white", "md", "w-full")}>
            Sign out and try another account
          </button>
        </form>
      </div>
    );
  }
  return <LoginForm next={target} configured={isAdminConfigured()} mode={adminAuthMode()} />;
}

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-navy-950 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLogo height={34} priority />
        </div>
        <div className="rounded-3xl bg-white p-7 shadow-card">
          <h1 className="text-xl font-extrabold tracking-tight">Admin sign in</h1>
          <p className="mt-1 text-sm text-navy-950/60">ShiftShield operations console.</p>
          <Suspense fallback={<div className="mt-6 h-32 animate-pulse rounded-xl bg-slate-50" />}>
            <Gate searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
