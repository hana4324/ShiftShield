"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { refreshAdminSession } from "@/app/actions/admin";

/**
 * Middleware-free session keepalive. See src/lib/supabase/middleware-free.ts.
 *
 * - `expired`: the server found an expired access token; refresh now, then re-render the route.
 * - otherwise: schedule a refresh two minutes before `expiresAt` while this tab stays open.
 */
export function SessionRefresh({
  expired,
  expiresAt,
}: {
  expired?: boolean;
  /** Unix seconds. */
  expiresAt?: number | null;
}) {
  const router = useRouter();
  const inflight = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async (reload: boolean) => {
      if (inflight.current) return;
      inflight.current = true;
      try {
        const { ok } = await refreshAdminSession();
        if (!ok) router.replace("/admin/login");
        else if (reload) router.refresh();
      } finally {
        inflight.current = false;
      }
    };
    if (expired) {
      void run(true);
      return;
    }
    if (expiresAt) {
      const delay = Math.max(5_000, expiresAt * 1000 - Date.now() - 2 * 60_000);
      timer = setTimeout(() => void run(false), delay);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [expired, expiresAt, router]);

  if (!expired) return null;
  return (
    <div className="p-6" role="status" aria-live="polite">
      <div className="rounded-2xl bg-white p-6 text-sm text-navy-950/70 shadow-card ring-1 ring-navy-950/5">
        Refreshing your session...
      </div>
    </div>
  );
}
