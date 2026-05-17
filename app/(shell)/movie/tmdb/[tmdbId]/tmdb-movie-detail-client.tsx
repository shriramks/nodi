"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";

import {
  addTmdbToWatchlistAction,
  markTmdbWatchedAction,
} from "../../actions";

export function TmdbUserStateActions({ tmdbId }: { tmdbId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"watch" | "watchlist" | null>(null);

  function run(
    pendingKey: "watch" | "watchlist",
    action: () => Promise<string>,
  ) {
    setError(null);
    setPendingAction(pendingKey);
    startTransition(async () => {
      try {
        const detailUrl = await action();
        router.push(detailUrl);
        router.refresh();
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <button
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent active:opacity-70 disabled:opacity-50"
          disabled={isPending}
          onClick={() => run("watch", () => markTmdbWatchedAction(tmdbId))}
          type="button"
        >
          {pendingAction === "watch" ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          ) : null}
          Mark Watched
        </button>

        <button
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
          disabled={isPending}
          onClick={() => run("watchlist", () => addTmdbToWatchlistAction(tmdbId))}
          type="button"
        >
          {pendingAction === "watchlist" ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          ) : null}
          + Watchlist
        </button>
      </div>

      {error ? <p className="text-[13px] text-unsynced">{error}</p> : null}
    </div>
  );
}
