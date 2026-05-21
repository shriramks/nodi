"use client";

import { useTransition, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { bulkUpdateRatingAction } from "@/app/(shell)/movie/bulk-actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SheetSection, SheetSectionDivider, SheetSectionHeader } from "@/components/ui/section";

const RATING_LABELS: Record<number, string> = {
  1: "Awful",
  2: "Bad",
  3: "Poor",
  4: "Below Average",
  5: "Average",
  6: "Fine",
  7: "Good",
  8: "Great",
  9: "Excellent",
  10: "Masterpiece",
};

type Props = {
  movieIds: string[];
  onClose: () => void;
  onDone: () => void;
};

export function BulkRatingSheet({ movieIds, onClose, onDone }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState<number | "clear" | null>(null);

  function handleRate(rating: number | null) {
    setError(null);
    setPendingRating(rating ?? "clear");
    startTransition(async () => {
      try {
        await bulkUpdateRatingAction(movieIds, rating);
        onDone();
      } catch {
        setError("Rating was not saved. Try again.");
      } finally {
        setPendingRating(null);
      }
    });
  }

  return (
    <BottomSheet
      ariaLabel="Rate Selected Movies"
      contentClassName="pt-3"
      dismissButtonLabel="Close ratings"
      onClose={onClose}
    >
      <div className="px-5 pb-3">
        <p className="text-[17px] font-semibold text-foreground">Rate Selected</p>
        <p className="mt-1 text-[13px] text-text-2">
          {movieIds.length} {movieIds.length === 1 ? "movie" : "movies"}
        </p>
      </div>

      <SheetSection className="py-0">
        <SheetSectionHeader>Rating</SheetSectionHeader>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleRate(n)}
            disabled={isPending}
            className="flex w-full items-center gap-3 border-b border-divider py-3 text-left last:border-b-0 active:opacity-70 disabled:opacity-50"
          >
            <span className="tabnum w-5 shrink-0 text-[17px] font-semibold text-foreground">
              {n}
            </span>
            <span className="flex-1 text-[15px] text-text-2">{RATING_LABELS[n]}</span>
            {pendingRating === n ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 shrink-0 animate-spin text-accent"
                strokeWidth={2.2}
              />
            ) : null}
          </button>
        ))}
      </SheetSection>

      <SheetSectionDivider className="mt-4" />

      <SheetSection className="pt-4">
        <button
          type="button"
          onClick={() => handleRate(null)}
          disabled={isPending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
        >
          {pendingRating === "clear" ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          ) : null}
          Clear ratings
        </button>

        {error && <p className="mt-2 text-[13px] text-unsynced">{error}</p>}
      </SheetSection>
    </BottomSheet>
  );
}
