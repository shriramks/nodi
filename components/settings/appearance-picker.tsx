"use client";

import { useState, useTransition } from "react";
import { Sun, Moon, Contrast } from "lucide-react";
import { updateThemeAction } from "@/app/(shell)/settings/actions";
import type { Theme } from "@/lib/db/types";

const OPTIONS: { value: Theme; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "auto", label: "Auto", Icon: Contrast },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function AppearancePicker({ current }: { current: Theme }) {
  const [selectedTheme, setSelectedTheme] = useState(current);
  const [, startTransition] = useTransition();

  function handleSelect(theme: Theme) {
    setSelectedTheme(theme);

    // Instant DOM update - no flash, no round-trip wait.
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
    <fieldset
      className="flex gap-0.5 rounded-xl p-1"
      style={{ backgroundColor: "var(--bg-tertiary)" }}
    >
      <legend className="sr-only">Appearance</legend>
      {OPTIONS.map(({ value, label, Icon }) => (
        <label
          key={value}
          className="flex flex-1 cursor-pointer"
        >
          <input
            checked={selectedTheme === value}
            className="peer sr-only"
            name="appearance"
            onChange={() => handleSelect(value)}
            type="radio"
            value={value}
          />
          <span
            className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-lg py-2 text-[12px] font-semibold transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
              selectedTheme === value
                ? "bg-background text-foreground shadow-sm"
                : "text-text-muted"
            }`}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
