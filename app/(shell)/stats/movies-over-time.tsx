"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Section, SectionHeader } from "@/components/ui/section";
import { monthLabels } from "@/lib/db/queries/stats-transforms";
import type { LibraryStatsTimeBucket } from "@/lib/db/types";

type View = "month" | "year";

function axisLabel(key: string, index: number): string {
  if (key.length === 4) return key;
  const monthIdx = parseInt(key.slice(5, 7), 10) - 1;
  if (monthIdx === 0 || index === 0) return `'${key.slice(2, 4)}`;
  return monthLabels[monthIdx];
}

function detectOutlierScale(buckets: LibraryStatsTimeBucket[]): number {
  const counts = buckets.map((b) => b.count).filter((c) => c > 0);
  if (counts.length <= 1) return Math.max(...counts, 1);
  const sorted = [...counts].sort((a, b) => a - b);
  const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? sorted[sorted.length - 1];
  const threshold = p75 * 3;
  const nonOutliers = counts.filter((c) => c <= threshold);
  return Math.max(...nonOutliers, p75, 1);
}

export function MoviesOverTime({
  monthBuckets,
  yearBuckets,
  tagFilter,
  returnTo,
}: {
  monthBuckets: LibraryStatsTimeBucket[];
  yearBuckets: LibraryStatsTimeBucket[];
  tagFilter?: string;
  returnTo: string;
}) {
  const [view, setView] = useState<View>("month");
  const scrollRef = useRef<HTMLDivElement>(null);

  const buckets = view === "month" ? monthBuckets : yearBuckets;
  const barWidth = view === "month" ? 32 : 52;
  const barGap = view === "month" ? 4 : 8;
  const scaleMax = detectOutlierScale(buckets);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [view]);

  return (
    <Section className="py-4">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader>Over time</SectionHeader>
        <div
          className="flex rounded-xl p-1 gap-0.5"
          style={{ backgroundColor: "var(--bg-secondary)" }}
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
              style={{ minHeight: 36 }}
            >
              {v === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          className="flex items-end"
          style={{
            gap: barGap,
            height: 120,
            paddingBottom: 20,
            paddingTop: 20,
            width: buckets.length * (barWidth + barGap) - barGap,
            minWidth: "100%",
          }}
        >
          {buckets.map((bucket, index) => {
            const isOutlier = bucket.count > scaleMax;
            const barHeight = bucket.count > 0
              ? `${Math.max((Math.min(bucket.count, scaleMax) / scaleMax) * 64, 5)}px`
              : "2px";
            return (
              <div
                key={bucket.key}
                className="flex flex-col items-center justify-end gap-1"
                style={{ width: barWidth, flexShrink: 0, height: "100%" }}
              >
                <span
                  className={`tabnum text-[10px] ${isOutlier ? "text-accent font-semibold" : "text-text-faint"}`}
                  style={{ minHeight: 14 }}
                >
                  {bucket.count > 0 ? bucket.count : ""}
                </span>
                <div
                  className={`w-full bg-watched transition-all duration-300 ${isOutlier ? "rounded-md" : "rounded-t-md"}`}
                  style={{
                    height: barHeight,
                    opacity: bucket.count > 0 ? 1 : 0.15,
                    position: "relative",
                  }}
                  aria-label={`${bucket.label}: ${bucket.count}`}
                >
                  {bucket.count > 0 && (
                    <Link
                      href={moviesTimeHref({
                        view,
                        key: bucket.key,
                        tagFilter,
                        returnTo,
                      })}
                      className="absolute inset-0"
                      aria-label={`View ${bucket.label} movies`}
                    />
                  )}
                  {isOutlier && (
                    <span
                      className="absolute text-[9px] text-accent font-bold"
                      style={{ top: -12, left: "50%", transform: "translateX(-50%)" }}
                    >
                      ↑
                    </span>
                  )}
                </div>
                <span
                  className="tabnum text-[10px] text-text-faint truncate"
                  style={{ width: barWidth, textAlign: "center" }}
                >
                  {axisLabel(bucket.key, index)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </Section>
  );
}

function moviesTimeHref({
  view,
  key,
  tagFilter,
  returnTo,
}: {
  view: View;
  key: string;
  tagFilter?: string;
  returnTo: string;
}) {
  const params = new URLSearchParams();
  params.set("from", "stats");
  params.set("returnTo", returnTo);
  if (tagFilter) params.set("tag", tagFilter);
  params.set(view, key);
  return `/movies?${params.toString()}`;
}
