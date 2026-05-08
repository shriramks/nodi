import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppError } from "@/lib/errors";
import { getMovieDetail } from "@/lib/db/queries";

type MovieDetailPageProps = {
  params: Promise<{
    movieId: string;
  }>;
};

export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  const { movieId } = await params;
  const movie = await loadMovieOrNotFound(movieId);

  return {
    title: movie.title,
  };
}

export default async function MovieDetailPage({ params }: MovieDetailPageProps) {
  const { movieId } = await params;
  const movie = await loadMovieOrNotFound(movieId);
  const statusLabel =
    movie.userMovie?.status === "watched"
      ? "Watched"
      : movie.userMovie?.status === "to_watch"
        ? "To watch"
        : "Not in library";

  return (
    <main className="space-y-6">
      <section className="space-y-4">
        <div className="aspect-[4/5] w-full rounded-[28px] bg-[linear-gradient(140deg,#1f2630_0%,#88514c_100%)]" />
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-text-faint">
            {statusLabel}
          </p>
          <h1 className="text-[32px] font-bold leading-none tracking-[-0.03em]">
            {movie.title}
          </h1>
          <p className="text-[13px] text-text-2">
            {[
              movie.primary_genre_name,
              movie.release_year,
              movie.runtime_minutes && `${movie.runtime_minutes} min`,
            ]
              .filter(Boolean)
              .join(" · ") || "Movie metadata"}
          </p>
        </div>
      </section>

      <section className="rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]">
        <p className="text-[15px] leading-7 text-text-2">{movie.overview ?? "No overview yet."}</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <article className="rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-text-faint">Your rating</p>
          <p className="tabnum mt-2 text-[28px] font-bold leading-none">
            {movie.userMovie?.personal_rating ?? "-"}
          </p>
        </article>
        <article className="rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-text-faint">TMDB</p>
          <p className="tabnum mt-2 text-[28px] font-bold leading-none">
            {movie.tmdb_vote_average ?? "-"}
          </p>
        </article>
      </section>

      {movie.tags.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {movie.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full border border-border bg-surface px-3 py-2 text-[12px] text-text-2"
            >
              {tag.name}
            </span>
          ))}
        </section>
      ) : null}

      {movie.watchLogs.length > 0 ? (
        <section className="rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]">
          <h2 className="text-[18px] font-semibold">Watch history</h2>
          <div className="mt-3 space-y-2">
            {movie.watchLogs.slice(0, 5).map((log) => (
              <p key={log.id} className="text-[13px] text-text-2">
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                  new Date(log.watched_at),
                )}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

async function loadMovieOrNotFound(movieId: string) {
  try {
    return await getMovieDetail(movieId);
  } catch (error) {
    if (
      isAppError(error) &&
      (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR")
    ) {
      notFound();
    }

    throw error;
  }
}
