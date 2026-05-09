import type { Metadata } from "next";
import { MovieLibraryGrid } from "@/components/movie/movie-library-grid";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { getLibraryStats, listUserMovies } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Movies",
};

export default async function MoviesPage() {
  const [watchedMovies, stats] = await Promise.all([
    listUserMovies({ status: "watched" }),
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
          <SettingsSheet />
        </div>
      </section>

      {watchedMovies.length > 0 ? (
        <MovieLibraryGrid movies={watchedMovies} />
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No watched movies yet. Search for a film to get started.
        </section>
      )}
    </main>
  );
}
