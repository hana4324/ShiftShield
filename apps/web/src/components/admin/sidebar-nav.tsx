"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

export interface NavItem {
  href: string;
  label: string;
  /** Badge count (pending licenses, open disputes). */
  count?: number | null;
}

/**
 * The URL read is isolated behind Suspense so the nav can be prerendered (including when the
 * layout uses it as a fallback) without blocking on `usePathname()`.
 */
export function SidebarNav({ items }: { items: NavItem[] }) {
  return (
    <Suspense fallback={<NavList items={items} pathname={null} />}>
      <ActiveNav items={items} />
    </Suspense>
  );
}

function ActiveNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return <NavList items={items} pathname={pathname} />;
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <nav
      aria-label="Admin"
      className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 lg:mt-8 lg:flex-col lg:items-stretch lg:overflow-visible"
    >
      {items.map((n) => {
        const active =
          pathname !== null &&
          (n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href));
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap focus-ring ${
              active ? "bg-white/10 text-white" : "text-steel-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>{n.label}</span>
            {typeof n.count === "number" && n.count > 0 ? (
              <span className="rounded-full bg-status-amber px-2 py-0.5 text-[11px] font-bold text-navy-950 tabular-nums">
                {n.count > 99 ? "99+" : n.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
