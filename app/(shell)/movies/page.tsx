import type { Metadata } from "next";
import { PosterCard } from "@/components/movie/poster-card";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { requireUser } from "@/lib/auth/server";
import { getLibraryStats, listTags, listUserMovies } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Movies",
};

export default async function MoviesPage() {
  const [user, watchedMovies, tags, stats] = await Promise.all([
    requireUser(),
    listUserMovies({ status: "watched" }),
    listTags(),
    getLibraryStats(),
  ]);

  return (
    <main className="space-y-6">
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-bold leading-[1.1]">Movies</h1>
            <p className="mt-1 text-[13px] text-text-2">
              <span className="tabnum">{stats.watchedCount}</span> watched
            </p>
          </div>
          <SettingsSheet userEmail={user.email ?? null} />
        </div>
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...tags.slice(0, 4).map((tag) => tag.name)].map((label, index) => (
          <span
            key={label}
            className={[
              "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px]",
              index === 0
                ? "bg-accent/15 font-semibold text-accent"
                : "border border-border bg-surface text-text-2",
            ].join(" ")}
          >
            {label}
          </span>
        ))}
      </section>

      {watchedMovies.length > 0 ? (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
          {watchedMovies.map(({ movie }) => (
            <PosterCard
              key={movie.id}
              movieId={movie.id}
              title={movie.title}
              posterPath={movie.poster_path}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No watched movies yet.
        </section>
      )}
    </main>
  );
}
