"use server";

import {
  addTagAction as addTag,
  addToWatchlistAction as addToWatchlist,
  addWatchDateAction as addWatchDate,
  attachTagByIdAction as attachTagById,
  deleteWatchLogAction as deleteWatchLog,
  markWatchedAction as markWatched,
  removeFromLibraryAction as removeFromLibrary,
  removeTagAction as removeTag,
  updateRatingAction as updateRating,
  updateWatchLogDateAction as updateWatchLogDate,
} from "../actions";

export async function markWatchedAction(movieId: string): Promise<void> {
  return markWatched(movieId);
}

export async function addToWatchlistAction(movieId: string): Promise<void> {
  return addToWatchlist(movieId);
}

export async function removeFromLibraryAction(movieId: string): Promise<void> {
  return removeFromLibrary(movieId);
}

export async function updateRatingAction(
  movieId: string,
  rating: number | null,
): Promise<void> {
  return updateRating(movieId, rating);
}

export async function addWatchDateAction(
  movieId: string,
  watchedDate: string,
): Promise<void> {
  return addWatchDate(movieId, watchedDate);
}

export async function addTagAction(movieId: string, name: string): Promise<void> {
  return addTag(movieId, name);
}

export async function attachTagByIdAction(movieId: string, tagId: string): Promise<void> {
  return attachTagById(movieId, tagId);
}

export async function removeTagAction(
  movieId: string,
  tagId: string,
): Promise<void> {
  return removeTag(movieId, tagId);
}

export async function deleteWatchLogAction(movieId: string, logId: string): Promise<void> {
  return deleteWatchLog(movieId, logId);
}

export async function updateWatchLogDateAction(
  movieId: string,
  logId: string,
  watchedDate: string,
): Promise<void> {
  return updateWatchLogDate(movieId, logId, watchedDate);
}
