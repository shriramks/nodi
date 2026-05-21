import type { Metadata } from "next";
import { MovieLibraryGrid } from "@/components/movie/movie-library-grid";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { PageHeader } from "@/components/ui/section";
import { listLibraryMoviesPage } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "To Watch",
};

export default async function ToWatchPage() {
  const queuePage = await listLibraryMoviesPage({ status: "to_watch" });

  return (
    <main className="space-y-6">
      <PageHeader
        title="To Watch"
        action={<SettingsSheet />}
        subtitle={<><span className="tabnum">{queuePage.totalCount}</span> queued</>}
      />

      {queuePage.movies.length > 0 ? (
        <MovieLibraryGrid
          initialPage={queuePage}
          pageStatus="to_watch"
        />
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No queued movies yet. Search for a film to add it to your watchlist.
        </section>
      )}
    </main>
  );
}
