"use client";

import { useState } from "react";
import { SettingsActionButton } from "@/components/ui/settings";

type SettingsErrorModalProps = {
  action: string;
  logKey?: string | null;
};

export function SettingsErrorModal({
  action,
  logKey,
}: SettingsErrorModalProps) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="alertdialog"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-2xl">
        <p className="text-[17px] font-semibold leading-[1.3] text-foreground">
          Error: Could not {action}.
        </p>
        {logKey ? (
          <p className="mt-2 text-[13px] leading-[1.4] text-text-2">
            Reference: {logKey}
          </p>
        ) : null}
        <SettingsActionButton
          className="mt-4"
          onClick={() => setOpen(false)}
          type="button"
        >
          Close
        </SettingsActionButton>
      </div>
    </div>
  );
}
