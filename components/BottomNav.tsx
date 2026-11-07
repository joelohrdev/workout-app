"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDB, useHydrated } from "@/lib/store";
import { ChartIcon, DumbbellIcon, HomeIcon, ListIcon, RunIcon } from "./Icons";

const TABS = [
  { href: "/", label: "Today", Icon: HomeIcon },
  { href: "/treadmill", label: "Treadmill", Icon: RunIcon },
  { href: "/routines", label: "Routines", Icon: ListIcon },
  { href: "/history", label: "History", Icon: ChartIcon },
];

export function BottomNav() {
  const path = usePathname();
  const db = useDB();
  const hydrated = useHydrated();
  const active = hydrated && db.activeSession && path !== "/workout";

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-lg">
      {active && (
        <Link
          href="/workout"
          className="mx-auto -mt-px flex max-w-xl items-center justify-between gap-3 bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          <span className="flex items-center gap-2 truncate">
            <DumbbellIcon width={18} height={18} />
            <span className="truncate">{db.activeSession!.name}</span>
          </span>
          <span className="shrink-0">Resume →</span>
        </Link>
      )}
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const on = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  on ? "text-accent" : "text-muted"
                }`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
