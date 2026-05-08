"use server";

import {
  addToWatchlistAction as addToWatchlist,
  markWatchedAction as markWatched,
  removeFromLibraryAction as removeFromLibrary,
  updateRatingAction as updateRating,
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
