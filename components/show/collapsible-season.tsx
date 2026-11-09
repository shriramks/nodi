"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { seasonDomId } from "@/components/show/season-pill";

type CollapsibleSeasonProps = {
  children: ReactNode;
  episodeCount: number;
  expanded: boolean;
  onToggle: () => void;
  seasonNumber: number;
  seasonRating?: ReactNode;
  seasonWatchControl?: ReactNode;
  watchedCount: number;
};

export function CollapsibleSeason({
  children,
  episodeCount,
  expanded,
  onToggle,
  seasonNumber,
  seasonRating,
  seasonWatchControl,
  watchedCount,
}: CollapsibleSeasonProps) {
  return (
    <article className="border-b border-divider" id={seasonDomId(seasonNumber)}>
      <div className="sticky top-[78px] z-10 flex min-h-10 items-center gap-0 border-b border-divider bg-background/95 backdrop-blur">
        <button
          aria-expanded={expanded}
          className="flex flex-1 items-center gap-2 px-4 py-2 text-left active:opacity-70"
          onClick={onToggle}
          type="button"
        >
          <ChevronDown
            aria-hidden="true"
            className={[
              "h-4 w-4 shrink-0 text-text-muted transition-transform duration-150",
              expanded ? "" : "-rotate-90",
            ].join(" ")}
            strokeWidth={2.2}
          />
          <h2 className="text-[17px] font-bold text-text-muted">
            {seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`}
          </h2>
          <span className="tabnum text-[13px] text-text-muted">
            {watchedCount}/{episodeCount}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2 pr-4">
          {seasonRating}
          {seasonWatchControl}
        </div>
      </div>
      {expanded ? <div>{children}</div> : null}
    </article>
  );
}
