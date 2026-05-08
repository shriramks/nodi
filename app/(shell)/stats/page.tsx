import type { Metadata } from "next";
import { getLibraryStats, listRecentWatchLogs } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Stats",
};

export default async function StatsPage() {
  const [stats, recentLogs] = await Promise.all([
    getLibraryStats(),
    listRecentWatchLogs(42),
  ]);
  const cards = [
    { label: "Hours watched", value: stats.hoursWatched.toString(), tone: "text-foreground" },
    { label: "Average rating", value: stats.averageRating?.toString() ?? "-", tone: "text-accent" },
    { label: "Rewatches", value: stats.rewatchCount.toString(), tone: "text-watched" },
    { label: "Languages", value: stats.languageCount.toString(), tone: "text-to-watch" },
  ];
  const latestWatchedAt = Math.max(
    ...recentLogs.map((log) => new Date(log.watched_at).getTime()),
    0,
  );
  const weeklyCounts = recentLogs.reduce<number[]>((counts, log) => {
    const weekIndex = Math.min(
      Math.floor(
        (latestWatchedAt - new Date(log.watched_at).getTime()) / (7 * 24 * 60 * 60 * 1000),
      ),
      5,
    );

    if (weekIndex >= 0) {
      counts[5 - weekIndex] += 1;
    }

    return counts;
  }, [0, 0, 0, 0, 0, 0]);
  const maxWeeklyCount = Math.max(...weeklyCounts, 1);

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-[32px] font-bold leading-[1.1]">Stats</h1>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <p className={`tabnum text-[32px] font-bold leading-[1.1] ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-1 text-[13px] text-text-muted">{card.label}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold">Recent pace</h2>
          <span className="text-[11px] text-text-faint">Recent 6 weeks</span>
        </div>
        <div className="mt-5 flex h-40 items-end gap-2">
          {weeklyCounts.map((value, index) => (
            <div key={value + index} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-xl bg-to-watch"
                style={{ height: `${Math.max((value / maxWeeklyCount) * 120, value ? 16 : 4)}px` }}
              />
              <span className="text-[11px] text-text-faint">{index + 1}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
