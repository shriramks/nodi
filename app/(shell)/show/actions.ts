"use server";

import { revalidatePath } from "next/cache";

import {
  addMediaEpisodeWatchDate,
  deleteMediaEpisodeWatchActivity,
  ingestPreparedTmdbShow,
  markMediaEpisodeUnwatched,
  markMediaEpisodeWatched,
  setMediaShowStatus,
  updateMediaEpisodeWatchActivityDate,
} from "@/lib/db/mutations";
import { AppError } from "@/lib/errors";
import type { TmdbShowIngestPayload } from "@/lib/providers/tmdb/adapters";

type ShowSaveStatus = "watching" | "wishlist";

function normalizeTmdbId(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError("Invalid TMDB show id.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return value;
}

function revalidateShowState(showId: string) {
  revalidatePath(`/show/${showId}`);
  revalidatePath("/library");
  revalidatePath("/wishlist");
  revalidatePath("/search");
  revalidatePath("/stats");
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

function revalidateEpisodeState(showId: string, episodeId: string) {
  revalidateShowState(showId);
  revalidatePath(`/show/${showId}/episode/${episodeId}`);
}

export async function saveTmdbShowToLibraryAction(
  payload: TmdbShowIngestPayload,
): Promise<string> {
  const show = await saveTmdbShow(payload, "watching");
  revalidatePath("/library");
  return `/show/${show.id}`;
}

export async function addTmdbShowToWishlistAction(
  payload: TmdbShowIngestPayload,
): Promise<string> {
  const show = await saveTmdbShow(payload, "wishlist");
  revalidatePath("/wishlist");
  return `/show/${show.id}`;
}

export async function saveShowToLibraryAction(showId: string): Promise<void> {
  await setMediaShowStatus(showId, "watching");
  revalidateShowState(showId);
}

export async function addShowToWishlistAction(showId: string): Promise<void> {
  await setMediaShowStatus(showId, "wishlist");
  revalidateShowState(showId);
}

export async function toggleEpisodeWatchedAction(
  showId: string,
  episodeId: string,
  watched: boolean,
): Promise<void> {
  if (watched) {
    await markMediaEpisodeWatched(showId, episodeId, {
      source: "manual",
      watchedAt: new Date().toISOString(),
    });
  } else {
    await markMediaEpisodeUnwatched(showId, episodeId);
  }

  revalidateEpisodeState(showId, episodeId);
}

export async function addEpisodeWatchDateAction(
  showId: string,
  episodeId: string,
  watchedDate: string,
): Promise<void> {
  await addMediaEpisodeWatchDate(showId, episodeId, {
    source: "manual",
    watchedAt: watchDateToTimestamp(watchedDate),
  });
  revalidateEpisodeState(showId, episodeId);
}

export async function deleteEpisodeWatchActivityAction(
  showId: string,
  episodeId: string,
  activityId: string,
): Promise<void> {
  await deleteMediaEpisodeWatchActivity(showId, episodeId, activityId);
  revalidateEpisodeState(showId, episodeId);
}

export async function updateEpisodeWatchActivityDateAction(
  showId: string,
  episodeId: string,
  activityId: string,
  watchedDate: string,
): Promise<void> {
  await updateMediaEpisodeWatchActivityDate(
    showId,
    episodeId,
    activityId,
    watchDateToTimestamp(watchedDate),
  );
  revalidateEpisodeState(showId, episodeId);
}

async function saveTmdbShow(payload: TmdbShowIngestPayload, status: ShowSaveStatus) {
  const tmdbId = normalizeTmdbId(payload.show.tmdbId);
  const show = await ingestPreparedTmdbShow(payload);

  await setMediaShowStatus(show.id, status);
  revalidatePath(`/show/tmdb/${tmdbId}`);
  revalidateShowState(show.id);

  return show;
}
