import type { Metadata } from "next";
import { PosterCard } from "@/components/movie/poster-card";

const watchedMovies = [
  { title: "Decision to Leave", year: "2022", tone: "from-[#0f2546] to-[#3a6da8]" },
  { title: "Perfect Blue", year: "1997", tone: "from-[#2b1e49] to-[#ce4066]" },
  { title: "Aftersun", year: "2022", tone: "from-[#8c531f] to-[#f1b46d]" },
  { title: "In the Mood for Love", year: "2000", tone: "from-[#253d2d] to-[#9f3c2f]" },
  { title: "Past Lives", year: "2023", tone: "from-[#2f2f42] to-[#8090ba]" },
  { title: "Memories of Murder", year: "2003", tone: "from-[#1f2f22] to-[#617751]" },
];

export const metadata: Metadata = {
  title: "Movies",
};

export default function MoviesPage() {
  return (
    <main className="space-y-6">
      <section className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-text-faint">
          Personal cinema
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-bold leading-none tracking-[-0.03em]">Movies</h1>
            <p className="mt-2 max-w-xs text-[13px] leading-5 text-text-2">
              Poster-first watched history with room for tags, dates, and sync state.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-[0_12px_32px_rgba(30,22,14,0.08)]">
            <p className="tabnum text-right text-[22px] font-semibold leading-none">214</p>
            <p className="mt-1 text-[11px] text-text-faint">watched</p>
          </div>
        </div>
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1">
        {["All", "2026", "Rewatches", "Thrillers", "Korean"].map((label, index) => (
          <span
            key={label}
            className={[
              "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px]",
              index === 0
                ? "bg-foreground text-background"
                : "border border-border bg-surface text-text-2",
            ].join(" ")}
          >
            {label}
          </span>
        ))}
      </section>

      <section className="grid grid-cols-3 gap-3">
        {watchedMovies.map((movie) => (
          <PosterCard key={movie.title} {...movie} />
        ))}
      </section>
    </main>
  );
}
