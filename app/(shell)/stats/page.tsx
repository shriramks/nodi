import type { Metadata } from "next";
import { getLibraryStats } from "@/lib/db/queries";
import type { LibraryStatsBreakdownItem, LibraryStatsRatingBucket } from "@/lib/db/types";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { MoviesOverTime } from "./movies-over-time";

export const metadata: Metadata = {
  title: "Stats",
};

export default async function StatsPage() {
  const stats = await getLibraryStats();
  const hasData = stats.watchEventCount > 0;

  return (
    <main className="space-y-4">
      <section>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[32px] font-bold leading-[1.1]">Stats</h1>
          <SettingsSheet />
        </div>
      </section>

      {/* Top metric cards */}
      <section className="grid grid-cols-2 gap-3">
        <MetricCard
          value={stats.watchedCount.toString()}
          label="Movies watched"
          valueClass="text-foreground"
        />
        <MetricCard
          value={formatRuntime(stats.runtimeMinutes)}
          label="Time watched"
          valueClass="text-accent"
        />
      </section>

      {hasData ? (
        <>
          <MoviesOverTime
            monthBuckets={stats.monthBuckets}
            yearBuckets={stats.yearBuckets}
          />

          <BreakdownSection
            title="By genre"
            items={stats.genreBreakdown}
            chipClass="bg-watched/12 text-watched"
            emptyText="No genre data yet."
          />

          <BreakdownSection
            title="By tag"
            items={stats.tagBreakdown}
            chipClass="bg-accent/12 text-accent"
            emptyText="No tagged watched movies yet."
          />

          <RatingDistribution breakdown={stats.ratingBreakdown} />

          <BreakdownSection
            title="By language"
            items={stats.languageBreakdown}
            chipClass="bg-watchlist/12 text-watchlist"
            emptyText="No language data yet."
          />
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No watch history yet. Mark a movie watched to see stats.
        </section>
      )}
    </main>
  );
}

function MetricCard({
  value,
  label,
  valueClass,
}: {
  value: string;
  label: string;
  valueClass: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      <p className={`tabnum break-words text-[30px] font-bold leading-[1.1] ${valueClass}`}>
        {value}
      </p>
      <p className="mt-1 text-[13px] text-text-muted">{label}</p>
    </article>
  );
}

function BreakdownSection({
  title,
  items,
  chipClass,
  emptyText = "No watched movies in this group yet.",
}: {
  title: string;
  items: LibraryStatsBreakdownItem[];
  chipClass: string;
  emptyText?: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-[20px] font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] leading-[1.4] text-text-2">{emptyText}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <div
              key={item.key}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${chipClass}`}
            >
              <span className="text-[14px] font-medium">{item.label}</span>
              <span className="tabnum text-[12px] opacity-60">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RatingDistribution({
  breakdown,
}: {
  breakdown: LibraryStatsRatingBucket[];
}) {
  const hasRatings = breakdown.some((b) => b.count > 0);
  const maxCount = Math.max(...breakdown.map((b) => b.count), 1);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-[20px] font-semibold">By rating</h2>
      {!hasRatings ? (
        <p className="mt-3 text-[13px] leading-[1.4] text-text-2">No rated movies yet.</p>
      ) : (
        <div className="mt-4 flex items-end gap-1.5" style={{ height: 88 }}>
          {breakdown.map(({ rating, count }) => (
            <div key={rating} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="tabnum text-[11px] text-text-faint" style={{ minHeight: 14 }}>
                {count > 0 ? count : ""}
              </span>
              <div
                className="w-full rounded-t-md bg-accent transition-all"
                style={{
                  height: count > 0
                    ? `${Math.max((count / maxCount) * 48, 4)}px`
                    : "2px",
                  opacity: count > 0 ? 1 : 0.12,
                }}
              />
              <span className="tabnum text-[11px] text-text-faint">{rating}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatRuntime(minutes: number) {
  if (minutes <= 0) {
    return "0m";
  }

  const days = Math.floor(minutes / 1440);
  const dayHours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = Math.floor(minutes % 60);
  const hours = Math.floor(minutes / 60);

  if (days > 0) {
    if (dayHours > 0 && remainingMinutes > 0) return `${days}d ${dayHours}h ${remainingMinutes}m`;
    if (dayHours > 0) return `${days}d ${dayHours}h`;
    if (remainingMinutes > 0) return `${days}d ${remainingMinutes}m`;
    return `${days}d`;
  }

  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  return `${remainingMinutes}m`;
}
