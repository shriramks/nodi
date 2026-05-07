"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/movies", label: "Movies" },
  { href: "/to-watch", label: "To Watch" },
  { href: "/stats", label: "Stats" },
  { href: "/search", label: "Search" },
];

export function BottomPillNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-4 z-50 px-4">
      <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-full border border-border bg-nav-surface p-2 shadow-[0_18px_50px_rgba(22,14,8,0.12)] backdrop-blur-md">
        {items.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex h-11 min-w-0 flex-1 items-center justify-center rounded-full px-3 text-[13px] font-semibold transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-text-2 hover:bg-surface-muted",
              ].join(" ")}
            >
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
