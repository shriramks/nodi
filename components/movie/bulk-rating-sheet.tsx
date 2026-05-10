"use client";

import { useTransition, useState } from "react";

import { bulkUpdateRatingAction } from "@/app/(shell)/movie/bulk-actions";

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

  function handleRate(rating: number | null) {
    setError(null);
    startTransition(async () => {
      try {
        await bulkUpdateRatingAction(movieIds, rating);
        onDone();
      } catch {
        setError("Rating was not saved. Try again.");
      }
    });
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rate Selected Movies"
        className="fixed inset-x-0 bottom-0 z-[60] rounded-t-3xl bg-surface px-5 pt-3"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-5 mt-2 h-1 w-9 rounded-full bg-surface-muted" />

        <p className="mb-1 text-[17px] font-semibold text-foreground">Rate Selected</p>
        <p className="mb-4 text-[13px] text-text-2">
          {movieIds.length} {movieIds.length === 1 ? "movie" : "movies"}
        </p>

        <div>
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
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => handleRate(null)}
          disabled={isPending}
          className="mt-4 h-11 w-full rounded-xl border border-border text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
        >
          Clear ratings
        </button>

        {error && <p className="mt-2 text-[13px] text-unsynced">{error}</p>}
      </div>
    </>
  );
}
