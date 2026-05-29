import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";

import { DetailHeroSection } from "@/components/media/detail-hero-section";
import { CreditPosterCard } from "@/components/media/credit-poster-card";
import { OverviewText } from "@/components/movie/overview-text";
import {
  CollapsibleSection,
  Section,
  SectionHeader,
  SectionScrollBleed,
} from "@/components/ui/section";
import { TmdbImagePrefetcher } from "@/components/media/tmdb-image-prefetcher";
import { DetailRow } from "@/components/ui/detail";
import type { MovieStatus } from "@/lib/db/types";
import { tmdbImage, tmdbImagePrefetchUrls } from "@/lib/providers/tmdb/images";
import { formatDate, getTmdbRating, languageDisplayName } from "@/lib/media/format";
import { MediaInfoPanel } from "@/components/media/media-info-panel";

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
  relatedMovies?: ReactNode;
  tagEditor?: ReactNode;
  watchedSummary?: ReactNode;
  watchHistory?: ReactNode;
};

export function MovieDetailView({
  actions,
  movie,
  ratingPicker,
  relatedMovies,
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
  const tmdbRating = getTmdbRating(movie);
  const prefetchUrls = tmdbImagePrefetchUrls([
    ...movie.cast.map((member) => ({
      path: member.profile_path,
      role: "profileAvatar" as const,
    })),
  ]);
  const detailRows = [
    movie.release_date ? { label: "Release", value: formatDate(movie.release_date) } : null,
    movie.runtime_minutes ? { label: "Runtime", value: `${movie.runtime_minutes} min` } : null,
    movie.original_language
      ? { label: "Language", value: languageDisplayName(movie.original_language) }
      : null,
    tmdbRating
      ? {
          label: "TMDB rating",
          value: tmdbRating.voteCount
            ? `${tmdbRating.value} · ${tmdbRating.voteCount.toLocaleString()} votes`
            : `${tmdbRating.value}`,
        }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <main className="-mt-6 space-y-4 pb-4">
      <TmdbImagePrefetcher urls={prefetchUrls} />
      <DetailHeroSection backdropPath={movie.backdrop_path} />

      <MediaInfoPanel
        className="relative -mt-[92px] min-h-[194px]"
        title={movie.title}
        posterPath={movie.poster_path}
        releaseYear={movie.release_year}
        originalLanguage={movie.original_language}
        primaryGenreName={movie.primary_genre_name}
        tmdbVoteAverage={movie.tmdb_vote_average}
        tmdbVoteCount={movie.tmdb_vote_count}
        tags={movie.tags}
        ratingPicker={ratingPicker}
        statusLabel={statusLabel}
        statusClassName={statusColour}
        statusOverride={watchedSummary}
      />

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

      {relatedMovies ?? <MovieRelatedMoviesSection movies={movie.relatedMovies ?? []} />}

    </main>
  );
}

export async function MovieRelatedMovies({
  movies,
}: {
  movies: Promise<NonNullable<DetailMovie["relatedMovies"]>>;
}) {
  return <MovieRelatedMoviesSection movies={await movies} />;
}

export function MovieRelatedMoviesLoading() {
  return (
    <Section>
      <SectionHeader>Related Movies</SectionHeader>
      <p className="text-[15px] leading-[1.4] text-text-muted">Loading related movies...</p>
    </Section>
  );
}

function MovieRelatedMoviesSection({
  movies,
}: {
  movies: NonNullable<DetailMovie["relatedMovies"]>;
}) {
  const prefetchUrls = tmdbImagePrefetchUrls(
    movies.map((relatedMovie) => ({
      path: relatedMovie.posterPath,
      role: "railPoster" as const,
    })),
  );

  return (
    <Section>
      <TmdbImagePrefetcher urls={prefetchUrls} />
      <SectionHeader>Related Movies</SectionHeader>
      {movies.length > 0 ? (
        <SectionScrollBleed className="flex gap-3 pb-1">
          {movies.map((relatedMovie) => (
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
