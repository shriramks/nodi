"use client";

import type { CSSProperties, ReactNode } from "react";

type BottomSheetProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onClose: () => void;
  showHandle?: boolean;
};

export function BottomSheet({
  ariaLabel,
  children,
  className = "",
  contentClassName = "px-5 pt-3",
  onClose,
  showHandle = true,
}: BottomSheetProps) {
  const sheetStyle: CSSProperties = {
    maxHeight: "calc(100dvh - env(safe-area-inset-top) - 1rem)",
    paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[60] bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={[
          "fixed inset-x-0 bottom-0 z-[70] overflow-y-auto rounded-t-3xl bg-surface",
          contentClassName,
          className,
        ].filter(Boolean).join(" ")}
        style={sheetStyle}
      >
        {showHandle && <div className="mx-auto mb-5 mt-2 h-1 w-9 rounded-full bg-surface-muted" />}
        {children}
      </div>
    </>
  );
}
