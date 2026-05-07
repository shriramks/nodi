import type { Metadata } from "next";

const queue = [
  { title: "Yi Yi", detail: "Edward Yang · 2000", state: "Tonight", color: "bg-to-watch/12 text-to-watch" },
  { title: "High and Low", detail: "Akira Kurosawa · 1963", state: "Soon", color: "bg-accent/12 text-accent" },
  { title: "Burning", detail: "Lee Chang-dong · 2018", state: "Weekend", color: "bg-foreground/8 text-foreground" },
];

export const metadata: Metadata = {
  title: "To Watch",
};

export default function ToWatchPage() {
  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-[32px] font-bold leading-none tracking-[-0.03em]">To Watch</h1>
        <p className="max-w-sm text-[13px] leading-5 text-text-2">
          A lightweight queue for future watches before it becomes full sync-backed state.
        </p>
      </section>

      <section className="space-y-3">
        {queue.map((movie) => (
          <article
            key={movie.title}
            className="flex items-center gap-4 rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]"
          >
            <div className="aspect-[2/3] w-16 rounded-2xl bg-[linear-gradient(160deg,#201d22_0%,#7c4f37_100%)]" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-semibold">{movie.title}</h2>
              <p className="mt-1 text-[11px] text-text-faint">{movie.detail}</p>
            </div>
            <span className={`rounded-full px-3 py-2 text-[11px] font-medium ${movie.color}`}>
              {movie.state}
            </span>
          </article>
        ))}
      </section>
    </main>
  );
}
