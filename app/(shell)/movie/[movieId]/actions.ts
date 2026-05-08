"use server";

import { revalidatePath } from "next/cache";
import {
  removeUserMovie,
  setMovieWatchStatus,
  updateMovieRating,
} from "@/lib/db/mutations";

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
