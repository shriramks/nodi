"use client";

import { useEffect, useState } from "react";

type SettingsErrorModalProps = {
  action: string;
  detail?: string | null;
  logKey?: string | null;
};

export function SettingsErrorModal({
  action,
  detail,
  logKey,
}: SettingsErrorModalProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const storedDetail = readStoredDetail(logKey);

    console.error(`Nodi error: could not ${action}.`, {
      action,
      detail: storedDetail ?? detail ?? null,
    });
  }, [action, detail, logKey]);

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
          Error: Could not {action}. Logs in console.
        </p>
        <button
          className="mt-4 h-11 w-full rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent"
          onClick={() => setOpen(false)}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function readStoredDetail(logKey?: string | null) {
  if (!logKey) {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(logKey);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return {
      error,
      message: "Could not read stored provider error details.",
    };
  }
}
