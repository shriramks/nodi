import type { Metadata } from "next";
import { PosterCard } from "@/components/movie/poster-card";
import { listUserMovies } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "To Watch",
};

export default async function ToWatchPage() {
  const queue = await listUserMovies({ status: "to_watch" });

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-[32px] font-bold leading-[1.1]">To Watch</h1>
        <p className="mt-1 text-[13px] text-text-2">
          <span className="tabnum">{queue.length}</span> queued
        </p>
      </section>

      {queue.length > 0 ? (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
          {queue.map(({ movie }) => (
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
          No queued movies yet. Search for a film to add it to your watchlist.
        </section>
      )}
    </main>
  );
}
