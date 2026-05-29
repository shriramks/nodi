"use client";

import { useRef, useState, useTransition } from "react";
import { Cloud, Contrast, Database, LogOut, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { updateThemeAction } from "@/app/(shell)/settings/actions";
import type { Theme } from "@/lib/db/types";

const THEME_OPTIONS: { value: Theme; label: string; Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }[] = [
  { value: "auto", label: "Auto", Icon: Contrast },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

type Props = {
  signOut: () => Promise<void>;
  theme: Theme;
};

export function SettingsPopover({ signOut, theme }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ right: number; top: number } | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  }

  function handleTheme(t: Theme) {
    setSelectedTheme(t);
    if (t === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", t);
    }
    startTransition(() => {
      updateThemeAction(t);
    });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Settings"
        onClick={handleOpen}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors active:bg-tap-active"
      >
        <Settings aria-hidden className="h-5 w-5" />
      </button>

      {open && pos ? (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Settings"
            className="fixed z-50 w-60 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            style={{ top: pos.top, right: pos.right }}
          >
            <div className="px-3 pt-3 pb-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                Appearance
              </p>
              <fieldset
                className="flex gap-0.5 rounded-xl p-1"
                style={{ backgroundColor: "var(--bg-tertiary)" }}
              >
                <legend className="sr-only">Appearance</legend>
                {THEME_OPTIONS.map(({ value, label, Icon }) => (
                  <label key={value} className="flex flex-1 cursor-pointer">
                    <input
                      checked={selectedTheme === value}
                      className="peer sr-only"
                      name="appearance"
                      onChange={() => handleTheme(value)}
                      type="radio"
                      value={value}
                    />
                    <span
                      className={[
                        "flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition-colors",
                        "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                        selectedTheme === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-text-muted",
                      ].join(" ")}
                    >
                      <Icon aria-hidden className="h-4 w-4" />
                      {label}
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>

            <div className="px-3 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                Sync
              </p>
            </div>

            <div className="h-px bg-divider" />

            <Link
              href="/settings/sync/tmdb"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-3 active:bg-tap-active"
            >
              <Database aria-hidden className="h-4 w-4 shrink-0 text-text-2" />
              <span className="flex-1 text-[14px] font-semibold text-foreground">TMDB</span>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text-faint">
                Required
              </span>
            </Link>

            <div className="h-px bg-divider" />

            <Link
              href="/settings/sync/trakt"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-3 active:bg-tap-active"
            >
              <Cloud aria-hidden className="h-4 w-4 shrink-0 text-text-2" />
              <span className="flex-1 text-[14px] font-semibold text-foreground">Trakt</span>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text-faint">
                Optional
              </span>
            </Link>

            <div className="h-px bg-divider" />

            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-tap-active"
              >
                <LogOut aria-hidden className="h-4 w-4 shrink-0 text-unsynced" />
                <span className="text-[14px] font-semibold text-unsynced">Sign out</span>
              </button>
            </form>

            <div className="h-2" />
          </div>
        </>
      ) : null}
    </>
  );
}
