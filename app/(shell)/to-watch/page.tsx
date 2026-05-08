import type { Metadata } from "next";
import { Film } from "lucide-react";
import Link from "next/link";
import { listUserMovies } from "@/lib/db/queries";

const posterBaseUrl = "https://image.tmdb.org/t/p/w185";

export const metadata: Metadata = {
  title: "To Watch",
};

export default async function ToWatchPage() {
  const queue = await listUserMovies({ status: "to_watch" });

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-[32px] font-bold leading-[1.1]">To Watch</h1>
      </section>

      {queue.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          {queue.map(({ movie, watchlisted_at }) => (
            <Link
              href={`/movie/${movie.id}`}
              key={movie.id}
              className="flex min-h-12 items-center gap-4 border-b border-divider px-4 py-3 last:border-b-0 hover:bg-tap-active"
            >
              <div
                aria-hidden="true"
                className="flex aspect-[2/3] w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-muted bg-cover bg-center"
                style={
                  movie.poster_path
                    ? { backgroundImage: `url(${posterBaseUrl}${movie.poster_path})` }
                    : undefined
                }
              >
                {movie.poster_path ? null : (
                  <Film className="h-5 w-5 text-text-faint" strokeWidth={1.8} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[17px] font-semibold">{movie.title}</h2>
                <p className="mt-1 text-[11px] text-text-faint">
                  {[movie.primary_genre_name, movie.release_year].filter(Boolean).join(" · ") ||
                    "Queued movie"}
                </p>
              </div>
              <span className="rounded-lg px-2 py-1 text-[11px] font-medium text-to-watch">
                {watchlisted_at ? "Queued" : "Saved"}
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No queued movies yet.
        </section>
      )}
    </main>
  );
}
