import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";

import {
  MovieDetailView,
  MovieRelatedMovies,
  MovieRelatedMoviesLoading,
} from "@/components/movie/movie-detail-view";
import { isAppError } from "@/lib/errors";
import { getMediaDetail, listTags } from "@/lib/db/queries";
import type { MovieStatus } from "@/lib/db/types";
import { enrichTmdbMovieOnDemand } from "@/lib/providers/tmdb/enrichment";
import { getRelatedTmdbMovies } from "@/lib/providers/tmdb/related";
import {
  RatingSheet,
  TagEditor,
  UserStateActions,
  WatchedSummary,
  WatchHistoryEditor,
} from "./movie-detail-client";

type MovieDetailPageProps = {
  params: Promise<{ movieId: string }>;
};

export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  const { movieId } = await params;
  const movie = await loadInitialMovieOrNotFound(movieId);
  return { title: movie.title };
}

export default async function MovieDetailPage({
  params,
}: MovieDetailPageProps) {
  const { movieId } = await params;
  const [movieRaw, allTags] = await Promise.all([
    loadInitialMovieOrNotFound(movieId),
    listTags(),
  ]);
  let movie = movieRaw;
  const enrichedItem = await enrichTmdbMovieOnDemand(movie);

  if (enrichedItem.tmdb_enriched_at !== movie.tmdb_enriched_at) {
    movie = await loadMovieOrNotFound(movie.id);
  }

  const tmdbMapping = movie.providerMappings.find(
    (m) => m.provider === "tmdb" && m.provider_media_type === "movie",
  );
  const tmdbId = tmdbMapping ? Number(tmdbMapping.provider_id) : null;
  const relatedMovies = tmdbId ? getRelatedTmdbMovies(tmdbId) : null;
  const { userMedia } = movie;
  const mediaStatus = userMedia?.status;
  const status: MovieStatus | null =
    mediaStatus === "done" ? "watched" :
    mediaStatus === "wishlist" ? "to_watch" :
    null;

  return (
    <MovieDetailView
      actions={<UserStateActions movieId={movie.id} status={status} />}
      movie={{
        ...movie,
        tmdb_id: tmdbId ?? undefined,
      }}
      ratingPicker={
        status === "watched" ? (
          <RatingSheet
            movieId={movie.id}
            currentRating={userMedia?.personal_rating ?? null}
          />
        ) : null
      }
      relatedMovies={
        relatedMovies ? (
          <Suspense fallback={<MovieRelatedMoviesLoading />}>
            <MovieRelatedMovies movies={relatedMovies} />
          </Suspense>
        ) : null
      }
      status={status}
      tagEditor={
        status ? <TagEditor movieId={movie.id} tags={movie.tags} allTags={allTags} /> : null
      }
      watchedSummary={
        status === "watched" ? <WatchedSummary watchActivity={movie.watchActivity} /> : null
      }
      watchHistory={
        status === "watched" ? (
          <WatchHistoryEditor movieId={movie.id} watchActivity={movie.watchActivity} />
        ) : null
      }
    />
  );
}

async function loadMovieOrNotFound(movieId: string) {
  try {
    return await getMediaDetail(movieId);
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

const loadInitialMovieOrNotFound = cache(loadMovieOrNotFound);
