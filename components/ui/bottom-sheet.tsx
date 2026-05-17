"use client";

import { X } from "lucide-react";
import { useEffect, type CSSProperties, type ReactNode } from "react";

type BottomSheetProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dismissButtonLabel?: string;
  onClose: () => void;
  showHandle?: boolean;
};

export function BottomSheet({
  ariaLabel,
  children,
  className = "",
  contentClassName = "px-5 pt-3",
  dismissButtonLabel,
  onClose,
  showHandle = true,
}: BottomSheetProps) {
  const sheetStyle: CSSProperties = {
    maxHeight: "calc(100dvh - env(safe-area-inset-top) - 1rem)",
    paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
  };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
        {dismissButtonLabel ? (
          <button
            type="button"
            aria-label={dismissButtonLabel}
            title={dismissButtonLabel}
            onClick={onClose}
            className="absolute right-2 top-1 flex size-11 items-center justify-center rounded-full text-text-2 active:bg-tap-active active:text-foreground"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
          </button>
        ) : null}
        {showHandle && <div className="mx-auto mb-5 mt-2 h-1 w-9 rounded-full bg-surface-muted" />}
        {children}
      </div>
    </>
  );
}
