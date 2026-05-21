import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { CreditPosterCard } from "@/components/media/credit-poster-card";
import { OverviewText } from "@/components/movie/overview-text";
import {
  CollapsibleSection,
  Section,
  SectionHeader,
  SectionScrollBleed,
} from "@/components/ui/section";
import { TmdbImagePrefetcher } from "@/components/media/tmdb-image-prefetcher";
import { DetailRow, DetailSourceList, type DetailSourceItem } from "@/components/ui/detail";
import type { MovieStatus } from "@/lib/db/types";
import { tmdbImage, tmdbImagePrefetchUrls } from "@/lib/providers/tmdb/images";

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

type DetailMovie = {
  title: string;
  tmdb_id?: number | null;
  poster_path: string | null;
  release_date: string | null;
  release_year: number | null;
  original_language: string | null;
  primary_genre_name: string | null;
  overview: string | null;
  backdrop_path?: string | null;
  runtime_minutes: number | null;
  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
  cast: Array<{
    id: string | number;
    tmdb_person_id?: number | null;
    name: string;
    character_name: string | null;
    profile_path: string | null;
  }>;
  tags?: Array<{
    id: string;
    name: string;
  }>;
  trivia?: DetailSourceItem[];
  relatedMovies?: Array<{
    id: number;
    title: string;
    posterPath: string | null;
    releaseYear: number | null;
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
  const prefetchUrls = tmdbImagePrefetchUrls([
    ...movie.cast.map((member) => ({
      path: member.profile_path,
      role: "profileAvatar" as const,
    })),
    ...(movie.relatedMovies ?? []).map((relatedMovie) => ({
      path: relatedMovie.posterPath,
      role: "railPoster" as const,
    })),
  ]);
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
    <main className="-mt-6 space-y-4 pb-4">
      <TmdbImagePrefetcher urls={prefetchUrls} />
      <section className="-mx-4">
        <div className="relative h-[244px] overflow-hidden bg-surface-muted">
          {movie.backdrop_path ? (
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              priority
              {...tmdbImage(movie.backdrop_path, "heroBackdrop")}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-muted">
              <Film aria-hidden="true" className="h-10 w-10 text-text-faint" strokeWidth={1.6} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-background" />
          <div
            className="absolute left-4 right-4 top-0 flex items-center justify-between"
            style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
          >
            <BackButton className="-ml-1 flex h-11 items-center gap-0.5 text-white drop-shadow-sm" />
            <SettingsSheet />
          </div>
        </div>
      </section>

      <section className="relative -mt-[92px] min-h-[194px]">
        <div className="absolute left-0 top-0 flex aspect-[2/3] w-32 items-center justify-center overflow-hidden rounded-2xl border-[5px] border-background bg-surface-muted shadow-sm">
          {movie.poster_path ? (
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              priority
              {...tmdbImage(movie.poster_path, "detailPoster")}
            />
          ) : (
            <Film aria-hidden="true" className="h-8 w-8 text-text-faint" strokeWidth={1.8} />
          )}
        </div>

        <div className="min-w-0 space-y-1.5 pl-36">
          <h1 className="text-[22px] font-bold leading-[1.2]">{movie.title}</h1>

          {metaLine && (
            <p className="text-[13px] leading-[1.35] text-text-2">{metaLine}</p>
          )}

          {watchedSummary ??
            (statusLabel && statusColour ? (
              <p className={`text-[15px] font-semibold ${statusColour}`}>
                {statusLabel}
              </p>
            ) : null)}

          <div className="flex items-center gap-2.5 pt-0.5">
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
      </section>

      {actions}

      {watchHistory}

      <Section>
        <SectionHeader>Plot</SectionHeader>
        <OverviewText text={movie.overview} />
      </Section>

      <Section>
        <SectionHeader>Cast</SectionHeader>
        {movie.cast.length > 0 ? (
          <SectionScrollBleed className="flex gap-3 pb-1">
            {movie.cast.map((member) => (
              <CastMemberLink
                key={member.id}
                characterName={member.character_name}
                backdropPath={movie.backdrop_path}
                movieTitle={movie.title}
                movieTmdbId={movie.tmdb_id}
                name={member.name}
                personId={member.tmdb_person_id}
                profilePath={member.profile_path}
              />
            ))}
          </SectionScrollBleed>
        ) : (
          <p className="text-[15px] leading-[1.4] text-text-muted">
            No cast details available.
          </p>
        )}
      </Section>

      <CollapsibleSection title="Trivia">
        <DetailSourceList
          emptyText="No source-backed trivia available."
          items={movie.trivia ?? []}
        />
      </CollapsibleSection>

      {status ? tagEditor : null}

      <CollapsibleSection title="Details">
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
      </CollapsibleSection>

      <Section>
        <SectionHeader>Related Movies</SectionHeader>
        {(movie.relatedMovies?.length ?? 0) > 0 ? (
          <SectionScrollBleed className="flex gap-3 pb-1">
            {movie.relatedMovies?.map((relatedMovie) => (
              <CreditPosterCard
                key={relatedMovie.id}
                href={`/movie/tmdb/${relatedMovie.id}`}
                posterPath={relatedMovie.posterPath}
                subtitle={relatedMovie.releaseYear ? String(relatedMovie.releaseYear) : null}
                title={relatedMovie.title}
              />
            ))}
          </SectionScrollBleed>
        ) : (
          <p className="text-[15px] leading-[1.4] text-text-muted">
            No related movies available.
          </p>
        )}
      </Section>

    </main>
  );
}

function CastMemberLink({
  backdropPath,
  characterName,
  movieTitle,
  movieTmdbId,
  name,
  personId,
  profilePath,
}: {
  backdropPath?: string | null;
  characterName: string | null;
  movieTitle: string;
  movieTmdbId?: number | null;
  name: string;
  personId?: number | null;
  profilePath: string | null;
}) {
  const content = (
    <>
      <div
        aria-hidden="true"
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-surface-muted"
      >
        {profilePath ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-[center_28%]"
            {...tmdbImage(profilePath, "profileAvatar")}
          />
        ) : (
          <Film className="h-5 w-5 text-text-faint" strokeWidth={1.8} />
        )}
      </div>
      <p className="mt-1.5 truncate text-center text-[11px] text-foreground">
        {name}
      </p>
      {characterName && (
        <p className="mt-0.5 truncate text-center text-[10px] text-text-faint">
          {characterName}
        </p>
      )}
    </>
  );

  if (!personId) {
    return <article className="w-16 shrink-0">{content}</article>;
  }

  const params = new URLSearchParams({ movie: movieTitle });
  if (movieTmdbId) {
    params.set("sourceMovieId", String(movieTmdbId));
  }
  if (backdropPath) {
    params.set("backdrop", backdropPath);
  }
  if (characterName) {
    params.set("character", characterName);
  }

  return (
    <Link
      className="w-16 shrink-0 active:opacity-70"
      href={`/person/tmdb/${personId}?${params.toString()}`}
    >
      {content}
    </Link>
  );
}
