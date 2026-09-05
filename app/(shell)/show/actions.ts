"use server";

import { revalidatePath } from "next/cache";

import {
  addMediaEpisodeWatchDate,
  attachTagToMediaShow,
  createAndAttachTagToMediaShow,
  deleteMediaEpisodeWatchActivity,
  detachTagFromMediaShow,
  ingestPreparedTmdbShow,
  markMediaEpisodeUnwatched,
  markMediaSeasonWatched,
  markMediaEpisodeWatched,
  removeUserMediaShow,
  setMediaShowStatus,
  updateMediaShowRating,
  updateMediaEpisodeWatchActivityDate,
} from "@/lib/db/mutations";
import { getShowDetail } from "@/lib/db/queries";
import { isAppError } from "@/lib/errors";
import type { TmdbShowIngestPayload } from "@/lib/providers/tmdb/adapters";
import { refreshShowEpisodesFromTmdb } from "@/lib/show/hydrate-show-episodes";
import { normalizeTmdbId, watchDateToTimestamp } from "../action-utils";

type ShowSaveStatus = "watching" | "wishlist";

function revalidateShowState(showId: string) {
  revalidatePath(`/show/${showId}`);
  revalidatePath("/library");
  revalidatePath("/wishlist");
  revalidatePath("/search");
  revalidatePath("/stats");
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

export async function markShowDoneAction(showId: string): Promise<void> {
  await setMediaShowStatus(showId, "done");
  revalidateShowState(showId);
}

export async function markShowStoppedAction(showId: string): Promise<void> {
  await setMediaShowStatus(showId, "stopped");
  revalidateShowState(showId);
}

export async function resumeShowAction(showId: string): Promise<void> {
  await setMediaShowStatus(showId, "watching");
  revalidateShowState(showId);
}

export type RefreshShowResult = { ok: true } | { ok: false; message: string };

export async function refreshShowFromTmdbAction(
  showId: string,
): Promise<RefreshShowResult> {
  try {
    const show = await getShowDetail(showId);
    await refreshShowEpisodesFromTmdb(show);
  } catch (error) {
    console.error("[refreshShowFromTmdbAction] failed", { showId, error });
    return {
      ok: false,
      // Only VALIDATION_ERROR's message is written for a person (e.g. "This
      // show has no TMDB link to refresh from."); anything else -- a DB
      // failure, a TMDB timeout -- gets one plain, consistent message here.
      // The real detail is already in the server log above.
      message:
        isAppError(error) && error.code === "VALIDATION_ERROR"
          ? error.message
          : "Couldn't check for new episodes. Try again in a moment.",
    };
  }

  revalidateShowState(showId);
  revalidatePath(`/show/${showId}/episodes`);
  return { ok: true };
}

export async function addShowToWishlistAction(showId: string): Promise<void> {
  await setMediaShowStatus(showId, "wishlist");
  revalidateShowState(showId);
}

export async function removeShowFromLibraryAction(showId: string): Promise<void> {
  await removeUserMediaShow(showId);
  revalidateShowState(showId);
}

export async function updateShowRatingAction(
  showId: string,
  rating: number | null,
): Promise<void> {
  await updateMediaShowRating(showId, { personalRating: rating });
  revalidateShowState(showId);
}

export async function addShowTagAction(showId: string, name: string): Promise<void> {
  await createAndAttachTagToMediaShow(showId, { name });
  revalidateShowState(showId);
}

export async function attachShowTagByIdAction(showId: string, tagId: string): Promise<void> {
  await attachTagToMediaShow(showId, tagId);
  revalidateShowState(showId);
}

export async function removeShowTagAction(showId: string, tagId: string): Promise<void> {
  await detachTagFromMediaShow(showId, tagId);
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

export async function markSeasonWatchedAction(
  showId: string,
  seasonNumber: number,
): Promise<void> {
  await markMediaSeasonWatched(showId, seasonNumber);
  revalidateShowState(showId);
  revalidatePath(`/show/${showId}/episodes`);
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
