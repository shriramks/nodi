"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import {
  addToWatchlistAction,
  markWatchedAction,
  removeFromLibraryAction,
  updateRatingAction,
} from "./actions";

type WatchStatus = "watched" | "to_watch" | null;

export function UserStateActions({
  movieId,
  status,
}: {
  movieId: string;
  status: WatchStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {status !== "watched" && (
          <button
            onClick={() => run(() => markWatchedAction(movieId))}
            disabled={isPending}
            className="h-11 flex-1 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent disabled:opacity-50"
          >
            {isPending ? "…" : "Mark Watched"}
          </button>
        )}

        {status === null && (
          <button
            onClick={() => run(() => addToWatchlistAction(movieId))}
            disabled={isPending}
            className="h-11 flex-1 rounded-xl border border-border px-4 text-[15px] font-semibold text-text-2 disabled:opacity-50"
          >
            + Watchlist
          </button>
        )}

        {status === "to_watch" && (
          <button
            onClick={() => run(() => removeFromLibraryAction(movieId))}
            disabled={isPending}
            className="h-11 rounded-xl border border-border px-4 text-[15px] font-semibold text-unsynced disabled:opacity-50"
          >
            {isPending ? "…" : "Remove"}
          </button>
        )}

        {status === "watched" && (
          <button
            onClick={() => run(() => removeFromLibraryAction(movieId))}
            disabled={isPending}
            className="h-11 flex-1 rounded-xl border border-border px-4 text-[15px] font-semibold text-unsynced disabled:opacity-50"
          >
            {isPending ? "…" : "Remove from Library"}
          </button>
        )}
      </div>

      {error ? (
        <p className="text-[13px] text-unsynced">{error}</p>
      ) : null}
    </div>
  );
}

export function RatingPicker({
  movieId,
  currentRating,
}: {
  movieId: string;
  currentRating: number | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRate(n: number) {
    const next = currentRating === n ? null : n;
    startTransition(() => updateRatingAction(movieId, next));
  }

  return (
    <div className="flex items-center gap-2">
      <Heart
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-text-muted"
        strokeWidth={1.8}
      />
      <div className="flex flex-1 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => handleRate(n)}
            disabled={isPending}
            style={{ flex: "1 1 0" }}
            className={[
              "flex h-8 min-w-0 items-center justify-center rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50",
              currentRating === n
                ? "bg-accent/15 text-accent"
                : "border border-border text-text-2",
            ].join(" ")}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
