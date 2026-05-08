import type { Metadata } from "next";
import { PosterCard } from "@/components/movie/poster-card";
import { getLibraryStats, listTags, listUserMovies } from "@/lib/db/queries";

const tones = [
  "from-[#0f2546] to-[#3a6da8]",
  "from-[#2b1e49] to-[#ce4066]",
  "from-[#8c531f] to-[#f1b46d]",
  "from-[#253d2d] to-[#9f3c2f]",
  "from-[#2f2f42] to-[#8090ba]",
  "from-[#1f2f22] to-[#617751]",
];

export const metadata: Metadata = {
  title: "Movies",
};

export default async function MoviesPage() {
  const [watchedMovies, tags, stats] = await Promise.all([
    listUserMovies({ status: "watched" }),
    listTags(),
    getLibraryStats(),
  ]);

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
            <p className="tabnum text-right text-[22px] font-semibold leading-none">
              {stats.watchedCount}
            </p>
            <p className="mt-1 text-[11px] text-text-faint">watched</p>
          </div>
        </div>
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...tags.slice(0, 4).map((tag) => tag.name)].map((label, index) => (
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

      {watchedMovies.length > 0 ? (
        <section className="grid grid-cols-3 gap-3">
          {watchedMovies.map(({ movie }, index) => (
            <PosterCard
              key={movie.id}
              movieId={movie.id}
              title={movie.title}
              year={movie.release_year?.toString() ?? "TBA"}
              tone={tones[index % tones.length]}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-[24px] border border-dashed border-border bg-surface p-5 text-[13px] leading-6 text-text-2">
          No watched movies yet. Add a movie from search or import history once sync is connected.
        </section>
      )}
    </main>
  );
}
