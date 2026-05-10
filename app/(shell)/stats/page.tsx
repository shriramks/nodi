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
    <main>
      {/* Header */}
      <section className="flex items-start justify-between gap-4 pb-5">
        <h1 className="text-[32px] font-bold leading-[1.1]">Stats</h1>
        <SettingsSheet />
      </section>

      {/* Primary hero — 3 main metrics inline, no card */}
      <section className="flex pb-4">
        <HeroMetric
          value={stats.watchedCount.toString()}
          label="Movies"
          valueClass="text-foreground"
        />
        <HeroMetric
          value={formatRuntime(stats.runtimeMinutes)}
          label="Time watched"
          valueClass="text-accent"
          fontSize={stats.runtimeMinutes >= 86400 ? 20 : 22}
        />
        <HeroMetric
          value={stats.avgRating !== null ? `♥ ${stats.avgRating}` : "—"}
          label="Avg rating"
          valueClass={stats.avgRating !== null ? "text-watched" : "text-text-faint"}
        />
      </section>

      {/* Secondary hero — supporting metrics */}
      {hasData && (
        <section className="flex pb-5">
          <HeroMetric
            value={stats.avgRuntimeMinutes > 0 ? formatRuntime(stats.avgRuntimeMinutes) : "—"}
            label="Avg runtime"
            valueClass="text-text-2"
            secondary
          />
          <HeroMetric
            value={stats.favGenre ?? "—"}
            label="Fav genre"
            valueClass="text-text-2"
            secondary
          />
          <HeroMetric
            value={stats.favDecade ?? "—"}
            label="Fav decade"
            valueClass="text-text-2"
            secondary
          />
        </section>
      )}

      <div className="h-px bg-divider" />

      {hasData ? (
        <>
          <MoviesOverTime
            monthBuckets={stats.monthBuckets}
            yearBuckets={stats.yearBuckets}
          />

          <div className="h-px bg-divider" />

          <SectionHeader title="By genre" />
          {stats.genreBreakdown.length === 0 ? (
            <EmptyBreakdown />
          ) : (
            <BarBreakdown items={stats.genreBreakdown} barColor="rgba(52,199,89,0.40)" />
          )}

          <div className="h-px bg-divider" />

          <SectionHeader title="By language" />
          {stats.languageBreakdown.length === 0 ? (
            <EmptyBreakdown />
          ) : (
            <ProportionBreakdown items={stats.languageBreakdown} color="rgba(10,132,255,0.55)" />
          )}

          <div className="h-px bg-divider" />

          <SectionHeader title="By tag" />
          {stats.tagBreakdown.length === 0 ? (
            <p className="pb-4 text-[15px] leading-[1.4] text-text-muted">No tagged watched movies yet.</p>
          ) : (
            <BarBreakdown items={stats.tagBreakdown} barColor="rgba(255,159,10,0.45)" />
          )}

          <div className="h-px bg-divider" />

          <SectionHeader title="By rating" />
          <RatingDistribution breakdown={stats.ratingBreakdown} />
        </>
      ) : (
        <p className="pt-6 text-[15px] leading-[1.4] text-text-2">
          No watch history yet. Mark a movie watched to see stats.
        </p>
      )}
    </main>
  );
}

function HeroMetric({
  value,
  label,
  valueClass,
  secondary = false,
  fontSize,
}: {
  value: string;
  label: string;
  valueClass: string;
  secondary?: boolean;
  fontSize?: number;
}) {
  const size = secondary ? 15 : (fontSize ?? 22);
  return (
    <div className="flex flex-1 min-w-0 flex-col gap-0.5 pr-3 [&+&]:pl-3 [&+&]:border-l [&+&]:border-divider last:pr-0">
      <p
        className={`tabnum font-bold leading-[1.1] truncate ${valueClass}`}
        style={{ fontSize: size, fontWeight: secondary ? 600 : 700 }}
      >
        {value}
      </p>
      <p className="text-[11px] text-text-muted truncate">{label}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="pt-4 pb-2 text-[17px] font-semibold">{title}</p>
  );
}

function EmptyBreakdown() {
  return <p className="pb-4 text-[15px] leading-[1.4] text-text-muted">No data yet.</p>;
}

function BarBreakdown({
  items,
  barColor,
}: {
  items: LibraryStatsBreakdownItem[];
  barColor: string;
}) {
  const maxCount = Math.max(...items.map((i) => i.count), 1);
  const unknownItems = items.filter((i) => i.key === "unknown");
  const knownItems = items.filter((i) => i.key !== "unknown");
  const ordered = [...knownItems, ...unknownItems];

  return (
    <div className="pb-2">
      {ordered.map((item) => {
        const isUnknown = item.key === "unknown";
        const pct = Math.max((item.count / maxCount) * 100, 2);
        return (
          <div
            key={item.key}
            className="flex items-center gap-2.5 border-b border-divider py-2 last:border-b-0"
            style={{ minHeight: 36 }}
          >
            <span
              className={`flex-1 min-w-0 text-[14px] truncate ${isUnknown ? "text-text-muted" : "text-foreground"}`}
            >
              {item.label}
            </span>
            <div className="relative flex-[2] h-[4px] rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${pct}%`,
                  background: isUnknown ? "rgba(0,0,0,0.15)" : barColor,
                }}
              />
            </div>
            <span className={`tabnum w-8 text-right text-[13px] font-medium shrink-0 ${isUnknown ? "text-text-muted" : "text-text-2"}`}>
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProportionBreakdown({
  items,
  color,
}: {
  items: LibraryStatsBreakdownItem[];
  color: string;
}) {
  const knownItems = items.filter((i) => i.key !== "unknown");
  const unknownItems = items.filter((i) => i.key === "unknown");
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0) return <EmptyBreakdown />;

  // Build segments — known items with decreasing opacity, then unknown
  const segments = [
    ...knownItems.map((item, idx) => ({
      item,
      opacity: Math.max(1 - idx * 0.15, 0.25),
      isUnknown: false,
    })),
    ...unknownItems.map((item) => ({
      item,
      opacity: 1,
      isUnknown: true,
    })),
  ];

  return (
    <div className="pb-4">
      {/* Stacked proportion bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full gap-px mb-3" style={{ background: "var(--bg-secondary)" }}>
        {segments.map(({ item, opacity, isUnknown }) => (
          <div
            key={item.key}
            style={{
              width: `${item.percentage}%`,
              background: isUnknown ? "rgba(0,0,0,0.15)" : color,
              opacity: isUnknown ? 1 : opacity,
              minWidth: item.percentage > 0 ? 2 : 0,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map(({ item, opacity, isUnknown }) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{
                background: isUnknown ? "rgba(0,0,0,0.18)" : color,
                opacity: isUnknown ? 1 : opacity,
              }}
            />
            <span className={`text-[12px] ${isUnknown ? "text-text-muted" : "text-text-2"}`}>
              {item.label}
            </span>
            <span className="tabnum text-[12px] text-text-faint">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RatingDistribution({ breakdown }: { breakdown: LibraryStatsRatingBucket[] }) {
  const hasRatings = breakdown.some((b) => b.count > 0);
  const maxCount = Math.max(...breakdown.map((b) => b.count), 1);

  if (!hasRatings) {
    return <EmptyBreakdown />;
  }

  return (
    <div className="flex items-end gap-1.5 pb-4" style={{ height: 80, paddingTop: 16 }}>
      {breakdown.map(({ rating, count }) => (
        <div key={rating} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm bg-accent transition-all"
            style={{
              height: count > 0 ? `${Math.max((count / maxCount) * 44, 3)}px` : "2px",
              opacity: count > 0 ? 1 : 0.12,
            }}
          />
          <span className="tabnum text-[10px] text-text-faint">{rating}</span>
        </div>
      ))}
    </div>
  );
}

function formatRuntime(minutes: number) {
  if (minutes <= 0) return "0m";
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
  if (hours > 0) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  return `${remainingMinutes}m`;
}
