"use client";

import { BarChart2, Bookmark, Film, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/movies", label: "Movies", Icon: Film },
  { href: "/to-watch", label: "To Watch", Icon: Bookmark },
  { href: "/stats", label: "Stats", Icon: BarChart2 },
  { href: "/search", label: "Search", Icon: Search },
];

export function BottomPillNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 z-50 px-4"
      style={{ bottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-md items-center gap-1 rounded-full border border-border bg-nav-surface p-2 backdrop-blur-md">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const { Icon } = item;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-[10px] font-semibold transition-colors",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-text-2 hover:bg-tap-active",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
