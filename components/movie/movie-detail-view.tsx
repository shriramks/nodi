import type { ReactNode } from "react";
import Image from "next/image";
import { Film } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { OverviewText } from "@/components/movie/overview-text";
import type { MovieStatus } from "@/lib/db/types";

function languageDisplayName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function formatReleaseDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

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
};

type MovieDetailViewProps = {
  movie: DetailMovie;
  status: MovieStatus | null;
  actions: ReactNode;
  ratingPicker?: ReactNode;
  tagEditor?: ReactNode;
  watchedSummary?: ReactNode;
  watchHistory?: ReactNode;
};

export function MovieDetailView({
  actions,
  movie,
  ratingPicker,
  status,
  tagEditor,
  watchedSummary,
  watchHistory,
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
    movie.original_language ? languageDisplayName(movie.original_language) : null,
    movie.primary_genre_name,
  ]
    .filter(Boolean)
    .join(" · ");
  const visibleTags = (movie.tags ?? []).slice(0, 3);
  const detailRows = [
    movie.release_date ? { label: "Release", value: formatReleaseDate(movie.release_date) } : null,
    movie.runtime_minutes ? { label: "Runtime", value: `${movie.runtime_minutes} min` } : null,
    movie.original_language
      ? { label: "Language", value: languageDisplayName(movie.original_language) }
      : null,
    movie.tmdb_vote_average !== null && movie.tmdb_vote_average !== undefined
      ? {
          label: "TMDB rating",
          value: movie.tmdb_vote_count
            ? `${movie.tmdb_vote_average} · ${movie.tmdb_vote_count.toLocaleString()} votes`
            : String(movie.tmdb_vote_average),
        }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <main className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <BackButton />
        <SettingsSheet />
      </div>

      <section>
        <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4">
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

          <div className="min-w-0 space-y-2 self-start">
            <h1 className="text-[22px] font-bold leading-[1.2]">{movie.title}</h1>

            {metaLine && (
              <p className="text-[13px] leading-[1.4] text-text-2">{metaLine}</p>
            )}

            {watchedSummary ??
              (statusLabel && statusColour ? (
                <p className={`text-[15px] font-semibold ${statusColour}`}>
                  {statusLabel}
                </p>
              ) : null)}

            <div className="flex items-center gap-2.5">
              {ratingPicker}
              {movie.tmdb_vote_average !== null &&
                movie.tmdb_vote_average !== undefined && (
                  <span className="text-[13px] text-text-muted">
                    · ★ {movie.tmdb_vote_average}
                  </span>
                )}
            </div>

            {visibleTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {visibleTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-lg border border-accent/25 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
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
        </div>
      </section>

      {actions}

      {watchHistory}

      <section className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-text-muted">Plot</p>
        <OverviewText text={movie.overview} />
      </section>

      <section className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-text-muted">Cast</p>
        {movie.cast.length > 0 ? (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {movie.cast.map((member) => (
              <article key={member.id} className="w-16 shrink-0">
                <div
                  aria-hidden="true"
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-surface-muted"
                >
                  {member.profile_path ? (
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-cover object-[center_28%]"
                      height={278}
                      sizes="64px"
                      src={`${profileBaseUrl}${member.profile_path}`}
                      width={185}
                    />
                  ) : (
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

      {status ? tagEditor : null}

      <section className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-text-muted">
          Details
        </p>
        {detailRows.length > 0 ? (
          <div>
            {detailRows.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} divider={false} />
            ))}
          </div>
        ) : (
          <p className="text-[15px] leading-[1.4] text-text-muted">
            No extra details available.
          </p>
        )}
      </section>

    </main>
  );
}

function DetailRow({
  label,
  value,
  divider = true,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <div
      className={[
        "flex min-h-11 items-center justify-between gap-4 px-4 py-2.5",
        divider ? "border-b border-divider last:border-b-0" : "",
      ].join(" ")}
    >
      <span className="text-[15px] text-text-2">{label}</span>
      <span className="tabnum text-[15px] font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}
