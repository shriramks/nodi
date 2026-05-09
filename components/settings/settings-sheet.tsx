"use client";

import { Settings } from "lucide-react";
import Link from "next/link";

export function SettingsSheet() {
  return (
    <Link
      aria-label="Settings"
      href="/settings"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors active:bg-tap-active"
    >
      <Settings aria-hidden="true" className="h-5 w-5" />
    </Link>
  );
}
