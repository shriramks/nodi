"use server";

import { revalidatePath } from "next/cache";

import {
  addMovieWatchDate,
  attachTagToMovie,
  createAndAttachTag,
  deleteWatchLog,
  detachTagFromMovie,
  ingestTmdbMovie,
  removeUserMovie,
  setMovieWatchStatus,
  updateMovieRating,
  updateWatchLogDate,
} from "@/lib/db/mutations";
import { AppError } from "@/lib/errors";
import {
  getTmdbMovieCredits,
  getTmdbMovieDetails,
} from "@/lib/providers/tmdb/client";

function normalizeTmdbId(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError("Invalid TMDB movie id.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return value;
}

function watchDateToTimestamp(value: string) {
  if (typeof value !== "string") {
    throw new AppError("Invalid watch date.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const watchedDate = value.trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(watchedDate) ||
    Number.isNaN(Date.parse(`${watchedDate}T00:00:00.000Z`))
  ) {
    throw new AppError("Invalid watch date.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return `${watchedDate}T12:00:00.000Z`;
}

function revalidateMovieState(movieId: string) {
  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/movies");
  revalidatePath("/to-watch");
  revalidatePath("/search");
  revalidatePath("/stats");
}

export async function markWatchedAction(movieId: string): Promise<void> {
  await setMovieWatchStatus({
    movieId,
    status: "watched",
    watchedAt: new Date().toISOString(),
    source: "manual",
  });
  revalidateMovieState(movieId);
}

export async function addToWatchlistAction(movieId: string): Promise<void> {
  await setMovieWatchStatus({
    movieId,
    status: "to_watch",
    source: "manual",
  });
  revalidateMovieState(movieId);
}

export async function markTmdbWatchedAction(tmdbId: number): Promise<string> {
  const movie = await saveTmdbMovie(tmdbId, "watched");
  revalidatePath("/movies");
  revalidatePath("/search");
  return `/movie/${movie.id}`;
}

export async function addTmdbToWatchlistAction(tmdbId: number): Promise<string> {
  const movie = await saveTmdbMovie(tmdbId, "to_watch");
  revalidatePath("/to-watch");
  revalidatePath("/search");
  return `/movie/${movie.id}`;
}

export async function removeFromLibraryAction(movieId: string): Promise<void> {
  await removeUserMovie(movieId);
  revalidateMovieState(movieId);
}

export async function updateRatingAction(
  movieId: string,
  rating: number | null,
): Promise<void> {
  await updateMovieRating(movieId, { personalRating: rating });
  revalidateMovieState(movieId);
}

export async function addWatchDateAction(
  movieId: string,
  watchedDate: string,
): Promise<void> {
  await addMovieWatchDate(movieId, {
    watchedAt: watchDateToTimestamp(watchedDate),
    source: "manual",
  });
  revalidateMovieState(movieId);
}

export async function addTagAction(movieId: string, name: string): Promise<void> {
  await createAndAttachTag(movieId, { name });
  revalidateMovieState(movieId);
}

export async function attachTagByIdAction(movieId: string, tagId: string): Promise<void> {
  await attachTagToMovie(movieId, tagId);
  revalidateMovieState(movieId);
}

export async function removeTagAction(
  movieId: string,
  tagId: string,
): Promise<void> {
  await detachTagFromMovie(movieId, tagId);
  revalidateMovieState(movieId);
}

export async function deleteWatchLogAction(
  movieId: string,
  logId: string,
): Promise<void> {
  await deleteWatchLog(movieId, logId);
  revalidateMovieState(movieId);
}

export async function updateWatchLogDateAction(
  movieId: string,
  logId: string,
  watchedDate: string,
): Promise<void> {
  await updateWatchLogDate(movieId, logId, watchDateToTimestamp(watchedDate));
  revalidateMovieState(movieId);
}

async function saveTmdbMovie(tmdbIdValue: number, status: "watched" | "to_watch") {
  const tmdbId = normalizeTmdbId(tmdbIdValue);
  const [detail, credits] = await Promise.all([
    getTmdbMovieDetails(tmdbId),
    getTmdbMovieCredits(tmdbId),
  ]);
  const movie = await ingestTmdbMovie(detail, credits);

  await setMovieWatchStatus({
    movieId: movie.id,
    status,
    watchedAt: status === "watched" ? new Date().toISOString() : null,
    source: "manual",
  });
  revalidatePath(`/movie/tmdb/${tmdbId}`);
  revalidatePath(`/movie/${movie.id}`);

  return movie;
}
