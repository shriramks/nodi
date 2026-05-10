"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addTmdbToWatchlistAction,
  markTmdbWatchedAction,
} from "../../actions";

export function TmdbUserStateActions({ tmdbId }: { tmdbId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<string>) {
    setError(null);
    startTransition(async () => {
      try {
        const detailUrl = await action();
        router.push(detailUrl);
        router.refresh();
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <button
          className="h-[50px] flex-1 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent active:opacity-70 disabled:opacity-50"
          disabled={isPending}
          onClick={() => run(() => markTmdbWatchedAction(tmdbId))}
          type="button"
        >
          {isPending ? "..." : "Mark Watched"}
        </button>

        <button
          className="h-[50px] flex-1 rounded-xl border border-border px-4 text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
          disabled={isPending}
          onClick={() => run(() => addTmdbToWatchlistAction(tmdbId))}
          type="button"
        >
          + Watchlist
        </button>
      </div>

      {error ? <p className="text-[13px] text-unsynced">{error}</p> : null}
    </div>
  );
}
