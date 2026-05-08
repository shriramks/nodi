import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import type {
  Movie,
  MovieCastMemberInsert,
  ProviderMappingInsert,
  UserMovie,
  UserMovieInsert,
  WatchLog,
} from "@/lib/db/types";
import {
  toMovieInsert,
  validateMoviePayload,
  validateRatingPayload,
  validateUuid,
  validateWatchActionPayload,
} from "@/lib/db/validation";
import { toMovieCastPayloads, toMoviePayload } from "@/lib/providers/tmdb/adapters";
import type { TmdbMovieCredits, TmdbMovieDetails } from "@/lib/providers/tmdb/client";
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

export async function ingestTmdbMovie(
  detail: TmdbMovieDetails,
  credits: TmdbMovieCredits,
): Promise<Movie> {
  const supabase = createSupabaseAdminClient();
  const movie = toMovieInsert(toMoviePayload(detail));

  const { data, error } = await supabase
    .from("movies")
    .upsert(movie, { onConflict: "tmdb_id" })
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to ingest TMDB movie metadata.", error);
  }

  const { error: deleteCastError } = await supabase
    .from("movie_cast")
    .delete()
    .eq("movie_id", data.id);

  if (deleteCastError) {
    throwDatabaseError("Failed to replace TMDB movie cast.", deleteCastError);
  }

  const castRows: MovieCastMemberInsert[] = toMovieCastPayloads(credits).map((member) => ({
    movie_id: data.id,
    ...member,
  }));

  if (castRows.length > 0) {
    const { error: castError } = await supabase.from("movie_cast").insert(castRows);

    if (castError) {
      throwDatabaseError("Failed to insert TMDB movie cast.", castError);
    }
  }

  const mappingRows: ProviderMappingInsert[] = [
    {
      movie_id: data.id,
      provider: "tmdb",
      provider_movie_id: String(detail.id),
    },
  ];

  if (detail.imdb_id) {
    mappingRows.push({
      movie_id: data.id,
      provider: "imdb",
      provider_movie_id: detail.imdb_id,
    });
  }

  const { error: deleteMappingsError } = await supabase
    .from("provider_mappings")
    .delete()
    .eq("movie_id", data.id)
    .in("provider", ["tmdb", "imdb"]);

  if (deleteMappingsError) {
    throwDatabaseError("Failed to replace movie provider mappings.", deleteMappingsError);
  }

  const { error: mappingError } = await supabase
    .from("provider_mappings")
    .upsert(mappingRows, { onConflict: "provider,provider_movie_id" });

  if (mappingError) {
    throwDatabaseError("Failed to upsert movie provider mappings.", mappingError);
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

export async function removeUserMovie(movieId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(movieId, "movieId");

  const { error } = await supabase
    .from("user_movies")
    .delete()
    .eq("user_id", user.id)
    .eq("movie_id", id);

  if (error) {
    throwDatabaseError("Failed to remove movie from library.", error);
  }
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
