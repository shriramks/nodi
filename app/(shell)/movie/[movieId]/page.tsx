import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { MovieDetailView } from "@/components/movie/movie-detail-view";
import { isAppError } from "@/lib/errors";
import { getMovieDetail, listTags } from "@/lib/db/queries";
import { enrichTmdbMovieOnDemand } from "@/lib/providers/tmdb/enrichment";
import { getMovieWikipediaTrivia } from "@/lib/providers/wikipedia/trivia";
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
  const enrichedMovie = await enrichTmdbMovieOnDemand(movie);

  if (enrichedMovie.tmdb_enriched_at && enrichedMovie.tmdb_enriched_at !== movie.tmdb_enriched_at) {
    movie = await loadMovieOrNotFound(enrichedMovie.id);
  }

  const trivia = await getMovieWikipediaTrivia({
    imdbId: movie.imdb_id,
    releaseYear: movie.release_year,
    title: movie.title,
    tmdbId: movie.tmdb_id,
  });
  const { userMovie } = movie;
  const status = userMovie?.status ?? null;

  return (
    <MovieDetailView
      actions={<UserStateActions movieId={movie.id} status={status} />}
      movie={{ ...movie, trivia }}
      ratingPicker={
        status === "watched" ? (
          <RatingSheet
            movieId={movie.id}
            currentRating={userMovie?.personal_rating ?? null}
          />
        ) : null
      }
      status={status}
      tagEditor={
        status ? <TagEditor movieId={movie.id} tags={movie.tags} allTags={allTags} /> : null
      }
      watchedSummary={
        status === "watched" ? <WatchedSummary watchLogs={movie.watchLogs ?? []} /> : null
      }
      watchHistory={
        status === "watched" ? (
          <WatchHistoryEditor movieId={movie.id} watchLogs={movie.watchLogs ?? []} />
        ) : null
      }
    />
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

const loadInitialMovieOrNotFound = cache(loadMovieOrNotFound);
