"use client";

import { BarChart3, Binoculars, Clapperboard, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/movies", label: "Movies", Icon: Clapperboard },
  { href: "/to-watch", label: "To Watch", Icon: Binoculars },
  { href: "/stats", label: "Stats", Icon: BarChart3 },
  { href: "/search", label: "Search", Icon: Search },
];

export function BottomPillNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-4 z-50 px-4">
      <div className="mx-auto flex h-16 w-full max-w-md items-center gap-1 rounded-full border border-border bg-nav-surface p-2 backdrop-blur-md">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const { Icon } = item;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors",
                isActive
                  ? "bg-foreground text-background"
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
