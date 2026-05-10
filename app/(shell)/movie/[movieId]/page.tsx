import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MovieDetailView } from "@/components/movie/movie-detail-view";
import { isAppError } from "@/lib/errors";
import { getMovieDetail } from "@/lib/db/queries";
import { enrichTmdbMovieOnDemand } from "@/lib/providers/tmdb/enrichment";
import {
  RatingSheet,
  TagEditor,
  UserStateActions,
  WatchDateForm,
} from "./movie-detail-client";

type MovieDetailPageProps = {
  params: Promise<{ movieId: string }>;
};

export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  const { movieId } = await params;
  const movie = await loadMovieOrNotFound(movieId);
  return { title: movie.title };
}

export default async function MovieDetailPage({
  params,
}: MovieDetailPageProps) {
  const { movieId } = await params;
  let movie = await loadMovieOrNotFound(movieId);
  const enrichedMovie = await enrichTmdbMovieOnDemand(movie);

  if (enrichedMovie.tmdb_enriched_at && enrichedMovie.tmdb_enriched_at !== movie.tmdb_enriched_at) {
    movie = await loadMovieOrNotFound(enrichedMovie.id);
  }

  const { userMovie } = movie;
  const status = userMovie?.status ?? null;

  return (
    <MovieDetailView
      actions={<UserStateActions movieId={movie.id} status={status} />}
      movie={movie}
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
        status ? <TagEditor movieId={movie.id} tags={movie.tags} /> : null
      }
      watchDateForm={
        status === "watched" ? <WatchDateForm movieId={movie.id} /> : null
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
