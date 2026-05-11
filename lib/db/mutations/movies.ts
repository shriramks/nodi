import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import type {
  Json,
  Movie,
  MovieCastMemberInsert,
  ProviderMappingInsert,
  UserMovie,
  WatchLog,
} from "@/lib/db/types";
import {
  buildUserMovieStatusPayload,
  latestTimestamp,
  shouldQueueOutboundSync,
} from "@/lib/db/mutations/movie-state";
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
import { createSyncEvent } from "./sync";

type TraktSyncPayload = Record<string, Json>;

async function queueTraktSyncEvent(eventType: string, payload: TraktSyncPayload) {
  await createSyncEvent({
    provider: "trakt",
    direction: "push",
    eventType,
    status: "pending",
    payload,
  });
}

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

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
  const metadataTimestamp = new Date().toISOString();
  const movie = {
    ...toMovieInsert(toMoviePayload(detail)),
    metadata_updated_at: metadataTimestamp,
    tmdb_enriched_at: metadataTimestamp,
  };

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

  const userMoviePayload = buildUserMovieStatusPayload({
    action,
    now,
    userId: user.id,
  });

  const { data: userMovie, error: userMovieError } = await supabase
    .from("user_movies")
    .upsert(userMoviePayload, { onConflict: "user_id,movie_id" })
    .select("*")
    .single();

  if (userMovieError) {
    throwDatabaseError("Failed to update movie watch status.", userMovieError);
  }

  if (action.status !== "watched" || !action.watchedAt) {
    if (shouldQueueOutboundSync(action.source)) {
      await queueTraktSyncEvent("movie.add_to_watchlist", {
        movieId: action.movieId,
        userMovieId: userMovie.id,
        watchlistedAt: userMovie.watchlisted_at ?? now,
      });
    }

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

  if (shouldQueueOutboundSync(action.source)) {
    await queueTraktSyncEvent("movie.mark_watched", {
      movieId: action.movieId,
      userMovieId: userMovie.id,
      watchLogId: watchLog.id,
      watchedAt: action.watchedAt,
      personalRating: Object.hasOwn(action, "personalRating")
        ? (action.personalRating ?? null)
        : null,
    });
  }

  return {
    userMovie,
    watchLog,
  };
}

export async function addMovieWatchDate(
  movieId: string,
  payload: unknown,
): Promise<{
  userMovie: UserMovie;
  watchLog: WatchLog;
}> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(movieId, "movieId");
  const action = validateWatchActionPayload({
    ...objectPayload(payload),
    movieId: id,
    status: "watched",
  });
  const watchedAt = action.watchedAt as string;

  const { data: existingUserMovie, error: existingUserMovieError } = await supabase
    .from("user_movies")
    .select("*")
    .eq("user_id", user.id)
    .eq("movie_id", id)
    .maybeSingle();

  if (existingUserMovieError) {
    throwDatabaseError("Failed to load existing movie watch state.", existingUserMovieError);
  }

  const { data: userMovie, error: userMovieError } = await supabase
    .from("user_movies")
    .upsert(
      {
        user_id: user.id,
        movie_id: id,
        status: "watched",
        watchlisted_at: null,
        last_watched_at: latestTimestamp(existingUserMovie?.last_watched_at, watchedAt),
      },
      { onConflict: "user_id,movie_id" },
    )
    .select("*")
    .single();

  if (userMovieError) {
    throwDatabaseError("Failed to update movie watch state.", userMovieError);
  }

  const { data: watchLog, error: watchLogError } = await supabase
    .from("watch_logs")
    .insert({
      user_id: user.id,
      movie_id: id,
      watched_at: watchedAt,
      source: action.source ?? "manual",
      provider_event_id: action.providerEventId ?? null,
      notes: action.notes ?? null,
    })
    .select("*")
    .single();

  if (watchLogError) {
    throwDatabaseError("Failed to append watch date.", watchLogError);
  }

  if (shouldQueueOutboundSync(action.source)) {
    await queueTraktSyncEvent("movie.add_watch_date", {
      movieId: id,
      userMovieId: userMovie.id,
      watchLogId: watchLog.id,
      watchedAt,
    });
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

  const { data: existingUserMovie, error: existingUserMovieError } = await supabase
    .from("user_movies")
    .select("*")
    .eq("user_id", user.id)
    .eq("movie_id", id)
    .maybeSingle();

  if (existingUserMovieError) {
    throwDatabaseError("Failed to load existing movie watch state.", existingUserMovieError);
  }

  const { error } = await supabase
    .from("user_movies")
    .delete()
    .eq("user_id", user.id)
    .eq("movie_id", id);

  if (error) {
    throwDatabaseError("Failed to remove movie from library.", error);
  }

  if (existingUserMovie?.status === "to_watch") {
    await queueTraktSyncEvent("movie.remove_from_watchlist", {
      movieId: id,
      userMovieId: existingUserMovie.id,
    });
  } else if (existingUserMovie?.status === "watched") {
    await queueTraktSyncEvent("movie.remove_from_library", {
      movieId: id,
      userMovieId: existingUserMovie.id,
    });
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

  await queueTraktSyncEvent(
    rating.personalRating === null ? "movie.rating.clear" : "movie.rating.set",
    {
      movieId: id,
      userMovieId: data.id,
      personalRating: rating.personalRating,
    },
  );

  return data;
}

export async function deleteWatchLog(movieId: string, logId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(logId, "logId");
  validateUuid(movieId, "movieId");

  const { error } = await supabase
    .from("watch_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throwDatabaseError("Failed to delete watch log.", error);
  }
}

export async function updateWatchLogDate(movieId: string, logId: string, watchedAt: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(logId, "logId");
  validateUuid(movieId, "movieId");

  const { error } = await supabase
    .from("watch_logs")
    .update({ watched_at: watchedAt })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throwDatabaseError("Failed to update watch log.", error);
  }
}
