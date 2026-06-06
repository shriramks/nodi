"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Section, SectionHeader } from "@/components/ui/section";
import { monthLabels } from "@/lib/db/queries/stats-transforms";
import type { LibraryStatsTimeBucket, MediaTypeFilter } from "@/lib/db/types";

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
  typeFilter,
  tagFilter,
  yearFilter,
  returnTo,
}: {
  monthBuckets: LibraryStatsTimeBucket[];
  yearBuckets: LibraryStatsTimeBucket[];
  typeFilter: MediaTypeFilter;
  tagFilter?: string;
  yearFilter?: string;
  returnTo: string;
}) {
  const [view, setView] = useState<View>("month");
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeView = yearFilter ? "month" : view;
  const buckets = activeView === "month" ? monthBuckets : yearBuckets;
  const barWidth = activeView === "month" ? 32 : 52;
  const barGap = activeView === "month" ? 4 : 8;
  const scaleMax = detectOutlierScale(buckets);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [activeView, yearFilter]);

  return (
    <Section className="py-4">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader>Over time</SectionHeader>
        {yearFilter ? (
          <span className="tabnum text-[13px] font-semibold text-accent">{yearFilter}</span>
        ) : (
          <div
            className="flex gap-0.5 rounded-xl p-1"
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
        )}
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          className="flex"
          style={{
            gap: barGap,
            paddingTop: 8,
            paddingBottom: 4,
            width: buckets.length * (barWidth + barGap) - barGap,
            minWidth: "100%",
          }}
        >
          {buckets.map((bucket, index) => {
            const isOutlier = bucket.count > scaleMax;
            const barHeight = bucket.count > 0
              ? `${Math.max((Math.min(bucket.count, scaleMax) / scaleMax) * 64, 5)}px`
              : "2px";
            const bucketContent = (
              <>
                {/* count — fixed height so every bar track starts at the same y */}
                <span
                  className={`tabnum text-[10px] leading-[14px] ${isOutlier ? "text-accent font-semibold" : "text-text-faint"}`}
                  style={{ height: 14 }}
                >
                  {bucket.count > 0 ? bucket.count : ""}
                </span>
                {/* fixed-height bar track — bars grow from a shared baseline */}
                <div className="flex w-full items-end" style={{ height: 64, position: "relative" }}>
                  <div
                    className={`w-full bg-watched transition-all duration-300 ${isOutlier ? "rounded-md" : "rounded-t-md"}`}
                    style={{
                      height: barHeight,
                      opacity: bucket.count > 0 ? 1 : 0.15,
                    }}
                    aria-label={`${bucket.label}: ${bucket.count}`}
                  />
                  {isOutlier && (
                    <span
                      className="absolute text-[9px] text-accent font-bold"
                      style={{ top: -2, left: "50%", transform: "translateX(-50%)" }}
                    >
                      ↑
                    </span>
                  )}
                </div>
                <span
                  className="tabnum text-[10px] text-text-faint truncate"
                  style={{ width: barWidth, textAlign: "center", marginTop: 6 }}
                >
                  {yearFilter ? bucket.label : axisLabel(bucket.key, index)}
                </span>
              </>
            );

            return bucket.count > 0 ? (
              <Link
                key={bucket.key}
                href={moviesTimeHref({
                  view: activeView,
                  key: bucket.key,
                  typeFilter,
                  tagFilter,
                  returnTo,
                })}
                className="flex flex-col items-center"
                style={{ width: barWidth, flexShrink: 0 }}
                aria-label={`View ${bucket.label} library items`}
              >
                {bucketContent}
              </Link>
            ) : (
              <div
                key={bucket.key}
                className="flex flex-col items-center"
                style={{ width: barWidth, flexShrink: 0 }}
              >
                {bucketContent}
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
  typeFilter,
  tagFilter,
  returnTo,
}: {
  view: View;
  key: string;
  typeFilter: MediaTypeFilter;
  tagFilter?: string;
  returnTo: string;
}) {
  const params = new URLSearchParams();
  params.set("from", "stats");
  params.set("type", typeFilter);
  params.set("returnTo", returnTo);
  if (tagFilter) params.set("tag", tagFilter);
  params.set(view, key);
  return `/library?${params.toString()}`;
}
