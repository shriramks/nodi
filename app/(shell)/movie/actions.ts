"use server";

import { revalidatePath } from "next/cache";

import {
  addMediaMovieWatchDate,
  attachTagToMediaMovie,
  createAndAttachTagToMediaMovie,
  deleteMediaMovieWatchActivity,
  detachTagFromMediaMovie,
  ingestPreparedTmdbMovieMedia,
  removeUserMediaMovie,
  setMediaMovieWatchStatus,
  updateMediaMovieRating,
  updateMediaMovieWatchActivityDate,
} from "@/lib/db/mutations";
import type { TmdbMovieIngestPayload } from "@/lib/providers/tmdb/adapters";
import { normalizeTmdbId, watchDateToTimestamp } from "../action-utils";

function revalidateMovieState(movieId: string) {
  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/library");
  revalidatePath("/wishlist");
  revalidatePath("/search");
  revalidatePath("/stats");
}

export async function markWatchedAction(movieId: string): Promise<void> {
  await setMediaMovieWatchStatus({
    movieId,
    status: "watched",
    watchedAt: new Date().toISOString(),
    source: "manual",
  });
  revalidateMovieState(movieId);
}

export async function addToWatchlistAction(movieId: string): Promise<void> {
  await setMediaMovieWatchStatus({
    movieId,
    status: "to_watch",
    source: "manual",
  });
  revalidateMovieState(movieId);
}

export async function markTmdbWatchedAction(
  payload: TmdbMovieIngestPayload,
): Promise<string> {
  const movie = await saveTmdbMovie(payload, "watched");
  revalidatePath("/library");
  revalidatePath("/search");
  return `/movie/${movie.id}`;
}

export async function addTmdbToWatchlistAction(
  payload: TmdbMovieIngestPayload,
): Promise<string> {
  const movie = await saveTmdbMovie(payload, "to_watch");
  revalidatePath("/wishlist");
  revalidatePath("/search");
  return `/movie/${movie.id}`;
}

export async function removeFromLibraryAction(movieId: string): Promise<void> {
  await removeUserMediaMovie(movieId);
  revalidateMovieState(movieId);
}

export async function updateRatingAction(
  movieId: string,
  rating: number | null,
): Promise<void> {
  await updateMediaMovieRating(movieId, { personalRating: rating });
  revalidateMovieState(movieId);
}

export async function addWatchDateAction(
  movieId: string,
  watchedDate: string,
): Promise<void> {
  await addMediaMovieWatchDate(movieId, {
    watchedAt: watchDateToTimestamp(watchedDate),
    source: "manual",
  });
  revalidateMovieState(movieId);
}

export async function addTagAction(movieId: string, name: string): Promise<void> {
  await createAndAttachTagToMediaMovie(movieId, { name });
  revalidateMovieState(movieId);
}

export async function attachTagByIdAction(movieId: string, tagId: string): Promise<void> {
  await attachTagToMediaMovie(movieId, tagId);
  revalidateMovieState(movieId);
}

export async function removeTagAction(
  movieId: string,
  tagId: string,
): Promise<void> {
  await detachTagFromMediaMovie(movieId, tagId);
  revalidateMovieState(movieId);
}

export async function deleteWatchLogAction(
  movieId: string,
  activityId: string,
): Promise<void> {
  await deleteMediaMovieWatchActivity(movieId, activityId);
  revalidateMovieState(movieId);
}

export async function updateWatchLogDateAction(
  movieId: string,
  activityId: string,
  watchedDate: string,
): Promise<void> {
  await updateMediaMovieWatchActivityDate(movieId, activityId, watchDateToTimestamp(watchedDate));
  revalidateMovieState(movieId);
}

async function saveTmdbMovie(
  payload: TmdbMovieIngestPayload,
  status: "watched" | "to_watch",
) {
  const tmdbId = normalizeTmdbId(payload.movie.tmdbId);
  const movie = await ingestPreparedTmdbMovieMedia(payload);

  await setMediaMovieWatchStatus({
    movieId: movie.id,
    status,
    watchedAt: status === "watched" ? new Date().toISOString() : null,
    source: "manual",
  });
  revalidatePath(`/movie/tmdb/${tmdbId}`);
  revalidatePath(`/movie/${movie.id}`);

  return movie;
}
