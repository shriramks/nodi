"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

// With no history to go back to (deep link, PWA cold open, OAuth return), fall back to a tab root
// so a screen without the bottom nav is never a dead end.
export function BackButton({ className, fallbackHref = "/library" }: { className?: string; fallbackHref?: string }) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length <= 1) {
      router.push(fallbackHref);
      return;
    }
    router.back();
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={className ?? "-ml-1 flex h-11 items-center gap-0.5 text-accent"}
      aria-label="Go back"
    >
      <ChevronLeft aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.5} />
      <span className="text-[17px]">Back</span>
    </button>
  );
}
