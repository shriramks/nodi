"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={className ?? "-ml-1 flex h-11 items-center gap-0.5 text-accent"}
      aria-label="Go back"
    >
      <ChevronLeft aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.5} />
      <span className="text-[17px]">Back</span>
    </button>
  );
}
