import type { Metadata } from "next";
import { getLibraryStats } from "@/lib/db/queries";
import type { LibraryStatsBreakdownItem, LibraryStatsTimeBucket } from "@/lib/db/types";

export const metadata: Metadata = {
  title: "Stats",
};

export default async function StatsPage() {
  const stats = await getLibraryStats();
  const cards = [
    {
      label: "Watched",
      value: stats.watchedCount.toString(),
      detail: `${stats.watchEventCount} ${stats.watchEventCount === 1 ? "log" : "logs"}`,
      tone: "text-foreground",
      className: "col-span-2",
    },
    { label: "Runtime", value: formatRuntime(stats.runtimeMinutes), tone: "text-accent" },
    { label: "Average rating", value: stats.averageRating?.toString() ?? "-", tone: "text-to-watch" },
    { label: "Languages", value: stats.languageCount.toString(), tone: "text-foreground" },
    { label: "Rewatches", value: stats.rewatchCount.toString(), tone: "text-watched" },
  ];

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-[32px] font-bold leading-[1.1]">Stats</h1>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className={`rounded-2xl border border-border bg-surface p-4 ${card.className ?? ""}`}
          >
            <p className={`tabnum text-[32px] font-bold leading-[1.1] ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-1 text-[13px] text-text-muted">{card.label}</p>
            {"detail" in card && card.detail ? (
              <p className="mt-1 text-[11px] text-text-faint">{card.detail}</p>
            ) : null}
          </article>
        ))}
      </section>

      {stats.watchEventCount > 0 ? (
        <>
          <TimeBreakdown buckets={stats.timeBuckets} />
          <BreakdownSection title="Genres" items={stats.genreBreakdown} tone="bg-accent" />
          <BreakdownSection title="Languages" items={stats.languageBreakdown} tone="bg-to-watch" />
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
  const maxRuntime = Math.max(...buckets.map((bucket) => bucket.runtimeMinutes), 0);
  const useRuntime = maxRuntime > 0;
  const maxValue = useRuntime
    ? maxRuntime
    : Math.max(...buckets.map((bucket) => bucket.count), 1);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold">Watch time</h2>
        <span className="text-[11px] text-text-faint">Recent 6 months</span>
      </div>
      <div className="mt-5 flex h-40 items-end gap-2">
        {buckets.map((bucket) => (
          <div key={bucket.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="tabnum text-[11px] text-text-faint">
              {useRuntime ? formatRuntime(bucket.runtimeMinutes) : bucket.count}
            </span>
            <div
              className="w-full rounded-t-xl bg-watched"
              style={{
                height: `${Math.max(
                  ((useRuntime ? bucket.runtimeMinutes : bucket.count) / maxValue) * 108,
                  bucket.count ? 16 : 4,
                )}px`,
              }}
              aria-label={`${bucket.label}: ${formatRuntime(bucket.runtimeMinutes)}, ${bucket.count} ${
                bucket.count === 1 ? "watch" : "watches"
              }`}
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
}: {
  title: string;
  items: LibraryStatsBreakdownItem[];
  tone: string;
}) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-[20px] font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.key} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[15px] font-medium">{item.label}</p>
              <p className="shrink-0 text-[12px] text-text-faint">
                <span className="tabnum">{item.count}</span> {item.count === 1 ? "watch" : "watches"}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${tone}`}
                style={{ width: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-faint">
              <span className="tabnum">{item.percentage}%</span>
              <span>{formatRuntime(item.runtimeMinutes)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatRuntime(minutes: number) {
  if (minutes <= 0) {
    return "0h";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (hours >= 100 || remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}
