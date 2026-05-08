import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MovieDetailView } from "@/components/movie/movie-detail-view";
import { isAppError } from "@/lib/errors";
import { getMovieDetail } from "@/lib/db/queries";
import {
  RatingPicker,
  UserStateActions,
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
  const movie = await loadMovieOrNotFound(movieId);
  const { userMovie } = movie;
  const status = userMovie?.status ?? null;

  return (
    <MovieDetailView
      actions={<UserStateActions movieId={movie.id} status={status} />}
      movie={movie}
      personalRating={userMovie?.personal_rating ?? null}
      ratingPicker={
        <RatingPicker
          movieId={movie.id}
          currentRating={userMovie?.personal_rating ?? null}
        />
      }
      status={status}
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
