import type { Metadata } from "next";
import { getLibraryStats } from "@/lib/db/queries";
import type { LibraryStatsBreakdownItem, LibraryStatsTimeBucket } from "@/lib/db/types";
import { SettingsSheet } from "@/components/settings/settings-sheet";

export const metadata: Metadata = {
  title: "Stats",
};

export default async function StatsPage() {
  const stats = await getLibraryStats();
  const cards = [
    { label: "Movies", value: stats.watchedCount.toString(), tone: "text-foreground" },
    { label: "Time", value: formatRuntime(stats.runtimeMinutes), tone: "text-accent" },
  ];

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[32px] font-bold leading-[1.1]">Stats</h1>
          <SettingsSheet />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <p className={`tabnum break-words text-[30px] font-bold leading-[1.1] ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-1 text-[13px] text-text-muted">{card.label}</p>
          </article>
        ))}
      </section>

      {stats.watchEventCount > 0 ? (
        <>
          <BreakdownSection title="Languages" items={stats.languageBreakdown} tone="bg-to-watch" />
          <BreakdownSection
            title="Tags"
            items={stats.tagBreakdown}
            tone="bg-accent"
            emptyText="No tagged watched movies yet."
          />
          <TimeBreakdown buckets={stats.timeBuckets} />
          <BreakdownSection title="Genres" items={stats.genreBreakdown} tone="bg-watched" />
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No watch history yet. Mark a movie watched to see stats.
        </section>
      )}
    </main>
  );
}

function TimeBreakdown({ buckets }: { buckets: LibraryStatsTimeBucket[] }) {
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold">Watched over time</h2>
        <span className="text-[11px] text-text-faint">Recent 6 months</span>
      </div>
      <div className="mt-5 flex h-40 items-end gap-2">
        {buckets.map((bucket) => (
          <div key={bucket.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="tabnum text-[11px] text-text-faint">
              {bucket.count}
            </span>
            <div
              className="w-full rounded-t-xl bg-watched"
              style={{
                height: `${Math.max(
                  (bucket.count / maxCount) * 108,
                  bucket.count ? 16 : 4,
                )}px`,
              }}
              aria-label={`${bucket.label}: ${bucket.count} ${
                bucket.count === 1 ? "movie" : "movies"
              }, ${formatRuntime(bucket.runtimeMinutes)}`}
            />
            <span className="max-w-full truncate text-[11px] text-text-faint">{bucket.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BreakdownSection({
  title,
  items,
  tone,
  emptyText = "No watched movies in this group yet.",
}: {
  title: string;
  items: LibraryStatsBreakdownItem[];
  tone: string;
  emptyText?: string;
}) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-[20px] font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] leading-[1.4] text-text-2">{emptyText}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item.key} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[15px] font-medium">{item.label}</p>
                <p className="shrink-0 text-[12px] text-text-faint">
                  <span className="tabnum">{item.count}</span> {item.count === 1 ? "movie" : "movies"}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full ${tone}`}
                  style={{ width: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
                />
              </div>
              <p className="tabnum text-[11px] text-text-faint">{item.percentage}%</p>
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
  const hours = Math.floor(minutes / 60);
  const dayHours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = Math.floor(minutes % 60);

  if (days > 0) {
    return dayHours > 0 ? `${days}d ${dayHours}h` : `${days}d`;
  }

  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  return `${remainingMinutes}m`;
}
