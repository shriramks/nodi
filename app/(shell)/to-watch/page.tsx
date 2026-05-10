import type { Metadata } from "next";
import { MovieLibraryGrid } from "@/components/movie/movie-library-grid";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { listTags, listUserMovies } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "To Watch",
};

export default async function ToWatchPage() {
  const [queue, allTags] = await Promise.all([
    listUserMovies({ status: "to_watch" }),
    listTags(),
  ]);

  return (
    <main className="space-y-6">
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-bold leading-[1.1]">To Watch</h1>
            <p className="mt-1 text-[13px] text-text-2">
              <span className="tabnum">{queue.length}</span> queued
            </p>
          </div>
          <SettingsSheet />
        </div>
      </section>

      {queue.length > 0 ? (
        <MovieLibraryGrid
          movies={queue}
          allTags={allTags}
          pageStatus="to_watch"
          showGenreFilter={false}
        />
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No queued movies yet. Search for a film to add it to your watchlist.
        </section>
      )}
    </main>
  );
}
