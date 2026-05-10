"use client";

import { useTransition } from "react";
import { Sun, Moon, Contrast } from "lucide-react";
import { updateThemeAction } from "@/app/(shell)/settings/actions";
import type { Theme } from "@/lib/db/types";

const OPTIONS: { value: Theme; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "auto", label: "Auto", Icon: Contrast },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function AppearancePicker({ current }: { current: Theme }) {
  const [, startTransition] = useTransition();

  function handleSelect(theme: Theme) {
    // Instant DOM update — no flash, no round-trip wait
    if (theme === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    startTransition(() => {
      updateThemeAction(theme);
    });
  }

  return (
    <div
      className="flex rounded-xl p-1 gap-0.5"
      style={{ backgroundColor: "var(--bg-tertiary)" }}
      role="group"
      aria-label="Appearance"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={current === value}
          onClick={() => handleSelect(value)}
          className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-2 text-[12px] font-semibold transition-colors ${
            current === value
              ? "bg-background text-foreground shadow-sm"
              : "text-text-muted"
          }`}
          style={{ minHeight: 56 }}
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </div>
  );
}
