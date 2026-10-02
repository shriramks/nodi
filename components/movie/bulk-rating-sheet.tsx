"use client";

import { useTransition, useState } from "react";

import { bulkUpdateRatingAction } from "@/app/(shell)/movie/bulk-actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { RatingOptions } from "@/components/media/rating-options";
import { SheetSection } from "@/components/ui/section";

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
      onClose={onClose}
    >
      <div className="px-5 pb-3">
        <p className="text-[13px] text-text-2">
          {movieIds.length} {movieIds.length === 1 ? "movie" : "movies"} selected
        </p>
      </div>

      <SheetSection className="py-0">
        <RatingOptions
          currentRating={undefined}
          disabled={isPending}
          excludeIds={movieIds}
          onCancel={onClose}
          onSelect={handleRate}
          pendingRating={pendingRating}
          title="Rate Selected"
        />
        {error && <p className="mt-2 text-[13px] text-unsynced">{error}</p>}
      </SheetSection>
    </BottomSheet>
  );
}
