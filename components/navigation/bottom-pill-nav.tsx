"use client";

import { BarChart2, Bookmark, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { RetroTvIcon } from "@/components/icons/retro-tv";

const tabs = [
  { href: "/library", label: "Library", Icon: RetroTvIcon },
  { href: "/wishlist", label: "Wishlist", Icon: Bookmark },
  { href: "/stats", label: "Stats", Icon: BarChart2 },
];

const addHref = "/search";
const collapseThreshold = 20;

export function BottomPillNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setCollapsed((prev) => {
        const next = window.scrollY > collapseThreshold;
        return next === prev ? prev : next;
      });
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleNavClickCapture(event: React.MouseEvent) {
    if (collapsed) {
      event.preventDefault();
      event.stopPropagation();
      setCollapsed(false);
    }
  }

  const isAddActive = pathname === addHref;
  // Shared pill chrome. Lives on the outer wrapper while collapsed (so the pill
  // and the Add button render as one continuous shape) and on the inner tab
  // group while expanded (so the Add button can float beside it as its own
  // circular CTA).
  const chrome = "h-[72px] items-center rounded-full border border-border bg-nav-surface p-2 backdrop-blur-md";

  return (
    <nav
      className="fixed inset-x-0 z-50 px-4"
      style={{ bottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={[
          "mx-auto flex items-center justify-center transition-all duration-200",
          collapsed ? ["w-fit", "gap-1", chrome].join(" ") : "w-full max-w-md gap-2.5",
        ].join(" ")}
        onClickCapture={handleNavClickCapture}
      >
        <div
          className={[
            "flex items-center transition-all duration-200",
            collapsed ? "flex-none gap-1" : ["flex-1", "gap-1", chrome].join(" "),
          ].join(" ")}
        >
          {tabs.map((item) => {
            const isActive = pathname === item.href;
            const { Icon } = item;
            const isCollapsedInactive = collapsed && !isActive;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-full text-[10px] font-semibold transition-all duration-200",
                  isCollapsedInactive
                    ? "w-0 flex-none overflow-hidden px-0 opacity-0"
                    : collapsed
                      ? "w-[52px] flex-none px-0"
                      : "min-w-0 flex-1 px-2 py-2",
                  isActive ? "bg-accent/10 text-accent" : "text-text-2 hover:bg-tap-active",
                ].join(" ")}
              >
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.2} />
                <span className={collapsed ? "hidden" : "truncate"}>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <Link
          href={addHref}
          aria-label="Add a movie or show"
          aria-current={isAddActive ? "page" : undefined}
          className={[
            "flex shrink-0 items-center justify-center rounded-full transition-all duration-200",
            collapsed
              ? "h-11 w-11 bg-transparent text-accent"
              : "h-[60px] w-[60px] bg-accent text-black shadow-[0_8px_20px_rgba(0,0,0,0.22)]",
          ].join(" ")}
        >
          <Plus
            aria-hidden="true"
            className={collapsed ? "h-5 w-5" : "h-6 w-6"}
            strokeWidth={2.6}
          />
        </Link>
      </div>
    </nav>
  );
}
