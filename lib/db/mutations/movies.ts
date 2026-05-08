import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import type { Movie, UserMovie, UserMovieInsert, WatchLog } from "@/lib/db/types";
import {
  toMovieInsert,
  validateMoviePayload,
  validateRatingPayload,
  validateUuid,
  validateWatchActionPayload,
} from "@/lib/db/validation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function upsertMovieMetadata(payload: unknown): Promise<Movie> {
  const supabase = createSupabaseAdminClient();
  const movie = toMovieInsert(validateMoviePayload(payload));

  const { data, error } = await supabase
    .from("movies")
    .upsert(movie, { onConflict: "tmdb_id" })
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to upsert movie metadata.", error);
  }

  return data;
}

export async function setMovieWatchStatus(payload: unknown): Promise<{
  userMovie: UserMovie;
  watchLog: WatchLog | null;
}> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const action = validateWatchActionPayload(payload);
  const now = new Date().toISOString();

  const userMoviePayload: UserMovieInsert = {
    user_id: user.id,
    movie_id: action.movieId,
    status: action.status,
  };

  if (action.status === "watched") {
    userMoviePayload.last_watched_at = action.watchedAt;
    userMoviePayload.watchlisted_at = null;
  } else {
    userMoviePayload.watchlisted_at = now;
    userMoviePayload.last_watched_at = null;
  }

  if (Object.hasOwn(action, "personalRating")) {
    userMoviePayload.personal_rating = action.personalRating ?? null;
  }

  const { data: userMovie, error: userMovieError } = await supabase
    .from("user_movies")
    .upsert(userMoviePayload, { onConflict: "user_id,movie_id" })
    .select("*")
    .single();

  if (userMovieError) {
    throwDatabaseError("Failed to update movie watch status.", userMovieError);
  }

  if (action.status !== "watched" || !action.watchedAt) {
    return {
      userMovie,
      watchLog: null,
    };
  }

  const { data: watchLog, error: watchLogError } = await supabase
    .from("watch_logs")
    .insert({
      user_id: user.id,
      movie_id: action.movieId,
      watched_at: action.watchedAt,
      source: action.source ?? "manual",
      provider_event_id: action.providerEventId ?? null,
      notes: action.notes ?? null,
    })
    .select("*")
    .single();

  if (watchLogError) {
    throwDatabaseError("Failed to append watch log.", watchLogError);
  }

  return {
    userMovie,
    watchLog,
  };
}

export async function updateMovieRating(movieId: string, payload: unknown): Promise<UserMovie> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(movieId, "movieId");
  const rating = validateRatingPayload(payload);

  const { data, error } = await supabase
    .from("user_movies")
    .update({ personal_rating: rating.personalRating })
    .eq("user_id", user.id)
    .eq("movie_id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to update movie rating.", error);
  }

  if (!data) {
    throwNotFound("Movie is not in the user's library.");
  }

  return data;
}
