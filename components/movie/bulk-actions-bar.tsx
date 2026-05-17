"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, LoaderCircle, Star, Tag } from "lucide-react";

import { bulkMarkWatchedAction, bulkAddToWatchlistAction } from "@/app/(shell)/movie/bulk-actions";
import { BulkTagSheet } from "./bulk-tag-sheet";
import { BulkRatingSheet } from "./bulk-rating-sheet";

type TagItem = { id: string; name: string };

type Props = {
  selectedIds: string[];
  allTags: TagItem[];
  pageStatus: "watched" | "to_watch";
  onDone: () => void;
};

export function BulkActionsBar({ selectedIds, allTags, pageStatus, onDone }: Props) {
  const [activeSheet, setActiveSheet] = useState<"tag" | "rate" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const count = selectedIds.length;

  function handleWatchAction() {
    setError(null);
    startTransition(async () => {
      try {
        if (pageStatus === "watched") {
          await bulkAddToWatchlistAction(selectedIds);
        } else {
          await bulkMarkWatchedAction(selectedIds);
        }
        onDone();
      } catch {
        setError("Action failed. Try again.");
      }
    });
  }

  return (
    <>
      <div
        className="fixed inset-x-0 z-30 flex items-center gap-2 border-t border-border bg-surface/95 px-4 backdrop-blur-md"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 64px)",
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        <span className="mr-1 shrink-0 text-[13px] font-medium tabnum text-text-2">
          {count} selected
        </span>

        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setActiveSheet("tag")}
            disabled={isPending}
            className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-medium text-foreground active:opacity-70 disabled:opacity-40"
          >
            <Tag aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            Tag
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet("rate")}
            disabled={isPending}
            className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-medium text-foreground active:opacity-70 disabled:opacity-40"
          >
            <Star aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            Rate
          </button>

          <button
            type="button"
            onClick={handleWatchAction}
            disabled={isPending}
            className="flex h-9 items-center gap-1.5 rounded-full bg-accent/15 px-3 text-[13px] font-medium text-accent active:opacity-70 disabled:opacity-40"
          >
            {isPending ? (
              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : pageStatus === "watched" ? (
              <EyeOff aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <Eye aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {pageStatus === "watched" ? (
              "Unwatch"
            ) : (
              "Watched"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="fixed inset-x-4 z-30 rounded-xl bg-unsynced/10 px-4 py-3 text-[13px] text-unsynced"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 120px)" }}
        >
          {error}
        </div>
      )}

      {activeSheet === "tag" && (
        <BulkTagSheet
          movieIds={selectedIds}
          allTags={allTags}
          onClose={() => setActiveSheet(null)}
          onDone={() => { setActiveSheet(null); onDone(); }}
        />
      )}

      {activeSheet === "rate" && (
        <BulkRatingSheet
          movieIds={selectedIds}
          onClose={() => setActiveSheet(null)}
          onDone={() => { setActiveSheet(null); onDone(); }}
        />
      )}
    </>
  );
}
