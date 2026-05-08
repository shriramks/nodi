"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { signOut } from "@/app/auth/actions";

type SettingsSheetProps = {
  userEmail: string | null;
};

export function SettingsSheet({ userEmail }: SettingsSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Settings"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors active:bg-tap-active"
      >
        <Settings aria-hidden="true" className="h-5 w-5" />
      </button>

      <div
        aria-hidden={!open}
        className={[
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setOpen(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={[
          "fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-surface px-5 pt-5",
          "pb-[calc(env(safe-area-inset-bottom,0px)+24px)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-surface-muted" />
        <p className="text-[11px] uppercase tracking-wide text-text-faint">Account</p>
        <p className="mt-2 truncate text-[15px] text-foreground">
          {userEmail ?? "Signed in"}
        </p>
        <form action={signOut} className="mt-5">
          <button
            type="submit"
            className="flex h-[50px] w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-[15px] font-semibold text-foreground transition-opacity active:opacity-70"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
