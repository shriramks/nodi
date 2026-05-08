import type { Metadata } from "next";
import Link from "next/link";
import { listUserMovies } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "To Watch",
};

export default async function ToWatchPage() {
  const queue = await listUserMovies({ status: "to_watch" });

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-[32px] font-bold leading-none tracking-[-0.03em]">To Watch</h1>
        <p className="max-w-sm text-[13px] leading-5 text-text-2">
          A lightweight queue for future watches before it becomes full sync-backed state.
        </p>
      </section>

      {queue.length > 0 ? (
        <section className="space-y-3">
          {queue.map(({ movie, watchlisted_at }) => (
            <Link
              href={`/movie/${movie.id}`}
              key={movie.id}
              className="flex items-center gap-4 rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]"
            >
              <div className="aspect-[2/3] w-16 rounded-2xl bg-[linear-gradient(160deg,#201d22_0%,#7c4f37_100%)]" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[17px] font-semibold">{movie.title}</h2>
                <p className="mt-1 text-[11px] text-text-faint">
                  {[movie.primary_genre_name, movie.release_year].filter(Boolean).join(" · ") ||
                    "Queued movie"}
                </p>
              </div>
              <span className="rounded-full bg-to-watch/12 px-3 py-2 text-[11px] font-medium text-to-watch">
                {watchlisted_at ? "Queued" : "Saved"}
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <section
          className="rounded-[24px] border border-dashed border-border bg-surface p-5 text-[13px] leading-6 text-text-2"
          >
          No queued movies yet. Your to-watch list will appear here after a movie is saved.
        </section>
      )}
    </main>
  );
}
