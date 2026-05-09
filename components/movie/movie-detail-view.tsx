import type { ReactNode } from "react";
import { Film } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { OverviewText } from "@/components/movie/overview-text";
import type { MovieStatus } from "@/lib/db/types";

const posterBaseUrl = "https://image.tmdb.org/t/p/w342";
const profileBaseUrl = "https://image.tmdb.org/t/p/w185";

type DetailMovie = {
  title: string;
  poster_path: string | null;
  release_date: string | null;
  release_year: number | null;
  original_language: string | null;
  primary_genre_name: string | null;
  overview: string | null;
  runtime_minutes: number | null;
  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
  cast: Array<{
    id: string | number;
    name: string;
    character_name: string | null;
    profile_path: string | null;
  }>;
  tags?: Array<{
    id: string;
    name: string;
  }>;
  watchLogs?: Array<{
    id: string;
    watched_at: string;
  }>;
};

type MovieDetailViewProps = {
  movie: DetailMovie;
  status: MovieStatus | null;
  personalRating: number | null;
  actions: ReactNode;
  ratingPicker?: ReactNode;
  tagEditor?: ReactNode;
  watchDateForm?: ReactNode;
};

export function MovieDetailView({
  actions,
  movie,
  personalRating,
  ratingPicker,
  status,
  tagEditor,
  watchDateForm,
}: MovieDetailViewProps) {
  const statusLabel =
    status === "watched" ? "Watched" : status === "to_watch" ? "To Watch" : null;
  const statusColour =
    status === "watched"
      ? "text-watched"
      : status === "to_watch"
        ? "text-to-watch"
        : null;
  const metaLine = [
    movie.release_year,
    movie.original_language?.toUpperCase(),
    movie.primary_genre_name,
  ]
    .filter(Boolean)
    .join(" · ");
  const visibleTags = (movie.tags ?? []).slice(0, 3);
  const watchLogs = movie.watchLogs ?? [];
  const detailRows = [
    movie.release_date ? { label: "Release", value: movie.release_date } : null,
    movie.runtime_minutes ? { label: "Runtime", value: `${movie.runtime_minutes} min` } : null,
    movie.original_language
      ? { label: "Language", value: movie.original_language.toUpperCase() }
      : null,
    movie.tmdb_vote_count !== null && movie.tmdb_vote_count !== undefined
      ? { label: "TMDB votes", value: movie.tmdb_vote_count.toLocaleString() }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <main className="space-y-6 pb-4">
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
          {!movie.poster_path && (
            <Film
              aria-hidden="true"
              className="h-7 w-7 text-text-faint"
              strokeWidth={1.8}
            />
          )}
        </div>

        <div className="min-w-0 space-y-2 self-center">
          <h1 className="text-[22px] font-bold leading-[1.15]">{movie.title}</h1>

          {metaLine && (
            <p className="text-[13px] leading-[1.4] text-text-2">{metaLine}</p>
          )}

          <div className="flex items-center gap-3">
            {statusLabel && statusColour && (
              <span className={`text-[15px] font-semibold ${statusColour}`}>
                {statusLabel}
              </span>
            )}
            {status === "watched" && (
              <span className="text-[15px] text-foreground">
                {personalRating !== null && personalRating !== undefined
                  ? `♥ ${personalRating}`
                  : "Not rated"}
              </span>
            )}
          </div>

          {movie.tmdb_vote_average !== null &&
            movie.tmdb_vote_average !== undefined && (
              <p className="text-[11px] text-text-faint">
                TMDB {movie.tmdb_vote_average}
                {movie.tmdb_vote_count
                  ? ` · ${movie.tmdb_vote_count.toLocaleString()} votes`
                  : ""}
              </p>
            )}

          {visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {visibleTags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-lg border border-border bg-surface px-2 py-0.5 text-[11px] text-text-2"
                >
                  {tag.name}
                </span>
              ))}
              {(movie.tags?.length ?? 0) > 3 && (
                <span className="rounded-lg border border-border px-2 py-0.5 text-[11px] text-text-faint">
                  +{(movie.tags?.length ?? 0) - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {actions}

      {status === "watched" ? ratingPicker : null}
      {status === "watched" ? watchDateForm : null}
      {status ? tagEditor : null}

      <section className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-text-faint">Plot</p>
        <OverviewText text={movie.overview} />
      </section>

      <section className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-text-faint">Cast</p>
        {movie.cast.length > 0 ? (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {movie.cast.map((member) => (
              <article key={member.id} className="w-16 shrink-0">
                <div
                  aria-hidden="true"
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-surface-muted bg-cover bg-top"
                  style={
                    member.profile_path
                      ? {
                          backgroundImage: `url(${profileBaseUrl}${member.profile_path})`,
                        }
                      : undefined
                  }
                >
                  {!member.profile_path && (
                    <Film
                      className="h-5 w-5 text-text-faint"
                      strokeWidth={1.8}
                    />
                  )}
                </div>
                <p className="mt-1.5 truncate text-center text-[11px] text-foreground">
                  {member.name}
                </p>
                {member.character_name && (
                  <p className="mt-0.5 truncate text-center text-[10px] text-text-faint">
                    {member.character_name}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-[15px] leading-[1.4] text-text-muted">
            No cast details available.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-text-faint">
          Details
        </p>
        {detailRows.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {detailRows.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        ) : (
          <p className="text-[15px] leading-[1.4] text-text-muted">
            No extra details available.
          </p>
        )}
      </section>

      {watchLogs.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-text-faint">
            Watch history
            {watchLogs.length > 1 ? ` · ${watchLogs.length}×` : ""}
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {watchLogs.slice(0, 5).map((log) => (
              <DetailRow
                key={log.id}
                label="Watched"
                value={new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                }).format(new Date(log.watched_at))}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-divider px-4 py-2.5 last:border-b-0">
      <span className="text-[15px] text-text-2">{label}</span>
      <span className="tabnum text-[15px] font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}
