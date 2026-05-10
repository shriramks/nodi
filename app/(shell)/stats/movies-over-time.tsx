"use client";

import { useEffect, useRef, useState } from "react";
import { monthLabels } from "@/lib/db/queries/stats-transforms";
import type { LibraryStatsTimeBucket } from "@/lib/db/types";

type View = "month" | "year";

function axisLabel(key: string, index: number): string {
  if (key.length === 4) return key; // year bucket
  const monthIdx = parseInt(key.slice(5, 7), 10) - 1;
  // Show year shorthand on January or the very first bucket
  if (monthIdx === 0 || index === 0) {
    return `'${key.slice(2, 4)}`;
  }
  return monthLabels[monthIdx];
}

export function MoviesOverTime({
  monthBuckets,
  yearBuckets,
}: {
  monthBuckets: LibraryStatsTimeBucket[];
  yearBuckets: LibraryStatsTimeBucket[];
}) {
  const [view, setView] = useState<View>("month");
  const scrollRef = useRef<HTMLDivElement>(null);

  const buckets = view === "month" ? monthBuckets : yearBuckets;
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const barWidth = view === "month" ? 32 : 52;
  const barGap = view === "month" ? 4 : 8;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [view]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold">Over time</h2>
        <div
          className="flex rounded-xl p-1 gap-0.5"
          style={{ backgroundColor: "var(--bg-tertiary)" }}
          role="tablist"
        >
          {(["month", "year"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3 text-[13px] font-semibold transition-colors ${
                view === v ? "bg-accent/10 text-accent" : "text-text-2"
              }`}
              style={{ minHeight: 44 }}
            >
              {v === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mt-5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          className="flex items-end"
          style={{
            gap: barGap,
            height: 152,
            paddingBottom: 20, // space for axis labels
            paddingTop: 20,    // space for count labels
            width: buckets.length * (barWidth + barGap) - barGap,
            minWidth: "100%",
          }}
        >
          {buckets.map((bucket, index) => (
            <div
              key={bucket.key}
              className="flex flex-col items-center justify-end gap-1.5"
              style={{ width: barWidth, flexShrink: 0, height: "100%" }}
            >
              <span className="tabnum text-[11px] text-text-faint" style={{ minHeight: 16 }}>
                {bucket.count > 0 ? bucket.count : ""}
              </span>
              <div
                className="w-full rounded-t-lg bg-watched transition-all duration-300"
                style={{
                  height: bucket.count > 0
                    ? `${Math.max((bucket.count / maxCount) * 80, 6)}px`
                    : "2px",
                  opacity: bucket.count > 0 ? 1 : 0.15,
                }}
                aria-label={`${bucket.label}: ${bucket.count} ${bucket.count === 1 ? "movie" : "movies"}`}
              />
              <span
                className="tabnum text-[11px] text-text-faint truncate"
                style={{ width: barWidth }}
              >
                {axisLabel(bucket.key, index)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
