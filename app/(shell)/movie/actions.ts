"use server";

import { revalidatePath } from "next/cache";

import {
  ingestTmdbMovie,
  removeUserMovie,
  setMovieWatchStatus,
  updateMovieRating,
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

export async function markWatchedAction(movieId: string): Promise<void> {
  await setMovieWatchStatus({
    movieId,
    status: "watched",
    watchedAt: new Date().toISOString(),
    source: "manual",
  });
  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/movies");
}

export async function addToWatchlistAction(movieId: string): Promise<void> {
  await setMovieWatchStatus({
    movieId,
    status: "to_watch",
    source: "manual",
  });
  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/to-watch");
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
  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/movies");
  revalidatePath("/to-watch");
}

export async function updateRatingAction(
  movieId: string,
  rating: number | null,
): Promise<void> {
  await updateMovieRating(movieId, { personalRating: rating });
  revalidatePath(`/movie/${movieId}`);
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
