import type { Metadata } from "next";

const cards = [
  { label: "Hours watched", value: "382", tone: "text-foreground" },
  { label: "Average rating", value: "8.1", tone: "text-accent" },
  { label: "Rewatches", value: "19", tone: "text-watched" },
  { label: "Languages", value: "14", tone: "text-to-watch" },
];

export const metadata: Metadata = {
  title: "Stats",
};

export default function StatsPage() {
  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-[32px] font-bold leading-none tracking-[-0.03em]">Stats</h1>
        <p className="max-w-sm text-[13px] leading-5 text-text-2">
          Placeholder analytics cards for the eventual watch-log driven dashboard.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]"
          >
            <p className={`tabnum text-[32px] font-bold leading-none tracking-[-0.04em] ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-text-faint">{card.label}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold">Recent pace</h2>
          <span className="text-[11px] text-text-faint">Last 6 weeks</span>
        </div>
        <div className="mt-5 flex h-40 items-end gap-2">
          {[7, 5, 9, 4, 8, 6].map((value, index) => (
            <div key={value + index} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-2xl bg-[linear-gradient(180deg,rgba(10,132,255,0.85)_0%,rgba(52,199,89,0.75)_100%)]"
                style={{ height: `${value * 12}px` }}
              />
              <span className="text-[11px] text-text-faint">{index + 1}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
