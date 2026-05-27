"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type CollapsibleSeasonProps = {
  children: ReactNode;
  defaultExpanded: boolean;
  episodeCount: number;
  seasonNumber: number;
  seasonWatchControl?: ReactNode;
  watchedCount: number;
};

export function CollapsibleSeason({
  children,
  defaultExpanded,
  episodeCount,
  seasonNumber,
  seasonWatchControl,
  watchedCount,
}: CollapsibleSeasonProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article className="border-b border-divider">
      <div className="sticky top-[78px] z-10 flex min-h-10 items-center gap-0 border-b border-divider bg-background/95 backdrop-blur">
        <button
          aria-expanded={expanded}
          className="flex flex-1 items-center gap-2 px-4 py-2 text-left active:opacity-70"
          onClick={() => setExpanded((e) => !e)}
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
        </button>
        <div className="flex shrink-0 items-center gap-2 pr-4">
          <span className="tabnum text-[13px] text-text-muted">
            {watchedCount}/{episodeCount}
          </span>
          {seasonWatchControl}
        </div>
      </div>
      {expanded ? <div>{children}</div> : null}
    </article>
  );
}
