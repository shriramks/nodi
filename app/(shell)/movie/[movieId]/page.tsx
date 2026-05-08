import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Calendar, Clock, Film, Heart, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { isAppError } from "@/lib/errors";
import { getMovieDetail } from "@/lib/db/queries";
import { BackButton } from "@/components/navigation/back-button";

const posterBaseUrl = "https://image.tmdb.org/t/p/w342";
const profileBaseUrl = "https://image.tmdb.org/t/p/w185";

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
  const statusTone =
    movie.userMovie?.status === "watched"
      ? "text-watched"
      : movie.userMovie?.status === "to_watch"
        ? "text-to-watch"
        : "text-text-muted";

  return (
    <main className="space-y-6">
      <BackButton />

      <section className="grid grid-cols-[112px_minmax(0,1fr)] gap-4">
        <div
          className="flex aspect-[2/3] w-full items-center justify-center rounded-2xl border border-border bg-surface-muted bg-cover bg-center"
          style={
            movie.poster_path
              ? { backgroundImage: `url(${posterBaseUrl}${movie.poster_path})` }
              : undefined
          }
        >
          {movie.poster_path ? null : (
            <Film aria-hidden="true" className="h-7 w-7 text-text-faint" strokeWidth={1.8} />
          )}
        </div>
        <div className="min-w-0 space-y-3 self-center">
          <h1 className="text-[22px] font-bold leading-[1.15]">
            {movie.title}
          </h1>
          <p className="text-[13px] leading-[1.4] text-text-2">
            {[
              movie.release_year,
              movie.original_language,
              movie.primary_genre_name,
            ]
              .filter(Boolean)
              .join(" · ") || "Movie metadata"}
          </p>
          <div className="space-y-2">
            <p className={`flex items-center gap-2 text-[15px] font-semibold ${statusTone}`}>
              <Heart aria-hidden="true" className="h-4 w-4" />
              {statusLabel}
            </p>
            <p className="flex items-center gap-2 text-[15px] text-text-2">
              <Star aria-hidden="true" className="h-4 w-4 text-text-muted" />
              {movie.userMovie?.personal_rating !== null && movie.userMovie?.personal_rating !== undefined
                ? movie.userMovie.personal_rating
                : "Not rated"}
            </p>
            {movie.tmdb_vote_average !== null && movie.tmdb_vote_average !== undefined ? (
              <p className="text-[13px] text-text-faint">
                TMDB {movie.tmdb_vote_average}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <p className="px-4 py-2 text-[11px] uppercase text-text-faint">Plot</p>
        <p className="px-4 text-[15px] leading-[1.4] text-text-2">
          {movie.overview ?? "No overview yet."}
        </p>
      </section>

      <section>
        <p className="px-4 py-2 text-[11px] uppercase text-text-faint">Details</p>
        <div className="border-y border-divider">
          <DetailRow
            icon={<Calendar aria-hidden="true" className="h-5 w-5" />}
            label="Release"
            value={movie.release_date ?? "Unknown"}
          />
          <DetailRow
            icon={<Clock aria-hidden="true" className="h-5 w-5" />}
            label="Runtime"
            value={movie.runtime_minutes ? `${movie.runtime_minutes} min` : "Unknown"}
          />
          <DetailRow label="Language" value={movie.original_language ?? "Unknown"} />
          <DetailRow label="TMDB votes" value={movie.tmdb_vote_count?.toString() ?? "-"} />
        </div>
      </section>

      {movie.cast.length > 0 ? (
        <section>
          <p className="px-4 py-2 text-[11px] uppercase text-text-faint">Cast</p>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {movie.cast.map((member) => (
              <article key={member.id} className="w-20 shrink-0">
                <div
                  aria-hidden="true"
                  className="flex aspect-square items-center justify-center rounded-2xl bg-surface-muted bg-cover bg-center"
                  style={
                    member.profile_path
                      ? { backgroundImage: `url(${profileBaseUrl}${member.profile_path})` }
                      : undefined
                  }
                >
                  {member.profile_path ? null : (
                    <Film className="h-5 w-5 text-text-faint" strokeWidth={1.8} />
                  )}
                </div>
                <p className="mt-2 truncate text-[13px] text-foreground">{member.name}</p>
                {member.character_name ? (
                  <p className="mt-0.5 truncate text-[11px] text-text-faint">
                    {member.character_name}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {movie.tags.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {movie.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text-2"
            >
              {tag.name}
            </span>
          ))}
        </section>
      ) : null}

      {movie.watchLogs.length > 0 ? (
        <section>
          <p className="px-4 py-2 text-[11px] uppercase text-text-faint">Watch history</p>
          <div className="border-y border-divider">
            {movie.watchLogs.slice(0, 5).map((log) => (
              <DetailRow
                key={log.id}
                label="Watched"
                value={new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                  new Date(log.watched_at),
                )}
              />
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

function DetailRow({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-divider px-4 py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2 text-[15px] text-text-2">
        {icon ? <span className="text-text-muted">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <p className="tabnum shrink-0 text-right text-[17px] font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}
