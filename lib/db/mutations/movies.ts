import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import type {
  MediaStatus,
  Movie,
  MovieCastMemberInsert,
  ProviderMappingInsert,
  UserMovie,
  WatchLog,
} from "@/lib/db/types";
import {
  buildMovieWatchStateMutationArgs,
} from "@/lib/db/mutations/movie-state";
import {
  toMovieInsert,
  validateMoviePayload,
  validateRatingPayload,
  validateUuid,
  validateWatchActionPayload,
} from "@/lib/db/validation";
import {
  toTmdbMovieIngestPayload,
  type TmdbMovieIngestPayload,
} from "@/lib/providers/tmdb/adapters";
import type { TmdbMovieCredits, TmdbMovieDetails } from "@/lib/providers/tmdb/client";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { objectPayload } from "@/lib/utils/invariant";
import { queueTraktPushEvent } from "./sync";

type MovieWatchStateMutationRow = {
  user_movie: UserMovie;
  watch_log: WatchLog | null;
};

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
  return ingestPreparedTmdbMovie(toTmdbMovieIngestPayload(detail, credits));
}

export async function ingestPreparedTmdbMovie(
  payload: TmdbMovieIngestPayload,
): Promise<Movie> {
  const supabase = createSupabaseAdminClient();
  const metadataTimestamp = new Date().toISOString();
  const movie = {
    ...toMovieInsert(validateMoviePayload(payload.movie)),
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

  const castRows: MovieCastMemberInsert[] = payload.cast.map((member) => ({
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
      provider_movie_id: String(payload.movie.tmdbId),
    },
  ];

  if (payload.movie.imdbId) {
    mappingRows.push({
      movie_id: data.id,
      provider: "imdb",
      provider_movie_id: payload.movie.imdbId,
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

  const { error: mediaItemError } = await supabase
    .from("media_items")
    .upsert(
      {
        id: data.id,
        type: "movie",
        title: data.title,
        original_title: data.original_title ?? null,
        release_date: data.release_date ?? null,
        first_air_date: null,
        primary_genre_id: data.primary_genre_id ?? null,
        primary_genre_name: data.primary_genre_name ?? null,
        original_language: data.original_language ?? null,
        overview: data.overview ?? null,
        poster_path: data.poster_path ?? null,
        backdrop_path: data.backdrop_path ?? null,
        runtime_minutes: data.runtime_minutes ?? null,
        tmdb_vote_average: data.tmdb_vote_average ?? null,
        tmdb_vote_count: data.tmdb_vote_count ?? null,
        popularity: data.popularity ?? null,
        metadata_updated_at: data.metadata_updated_at,
        tmdb_enriched_at: data.tmdb_enriched_at ?? null,
        created_at: data.created_at,
      },
      { onConflict: "id" },
    );

  if (mediaItemError) {
    throwDatabaseError("Failed to sync movie to media_items.", mediaItemError);
  }

  return data;
}

export async function setMovieWatchStatus(payload: unknown): Promise<{
  userMovie: UserMovie;
  watchLog: WatchLog | null;
}> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const action = validateWatchActionPayload(payload);
  const { data, error } = await supabase
    .rpc(
      "apply_movie_watch_state",
      buildMovieWatchStateMutationArgs({
        action,
        operation: "set_status",
      }),
    )
    .single<MovieWatchStateMutationRow>();

  if (error) {
    throwDatabaseError("Failed to update movie watch status.", error);
  }

  await syncUserMovieToUserMedia(supabase, data.user_movie);

  return {
    userMovie: data.user_movie,
    watchLog: data.watch_log,
  };
}

export async function addMovieWatchDate(
  movieId: string,
  payload: unknown,
): Promise<{
  userMovie: UserMovie;
  watchLog: WatchLog;
}> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(movieId, "movieId");
  const action = validateWatchActionPayload({
    ...objectPayload(payload),
    movieId: id,
    status: "watched",
  });
  const { data, error } = await supabase
    .rpc(
      "apply_movie_watch_state",
      buildMovieWatchStateMutationArgs({
        action,
        operation: "add_watch_date",
      }),
    )
    .single<MovieWatchStateMutationRow>();

  if (error) {
    throwDatabaseError("Failed to append watch date.", error);
  }

  if (!data.watch_log) {
    throwDatabaseError("Failed to append watch date.", {
      message: "Movie watch-state mutation did not return a watch log.",
    });
  }

  await syncUserMovieToUserMedia(supabase, data.user_movie);

  return {
    userMovie: data.user_movie,
    watchLog: data.watch_log,
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

  await supabase
    .from("user_media")
    .delete()
    .eq("user_id", user.id)
    .eq("media_id", id);

  if (existingUserMovie?.status === "to_watch") {
    await queueTraktPushEvent("movie.remove_from_watchlist", {
      movieId: id,
      userMovieId: existingUserMovie.id,
    });
  } else if (existingUserMovie?.status === "watched") {
    await queueTraktPushEvent("movie.remove_from_library", {
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

  await queueTraktPushEvent(
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

async function syncUserMovieToUserMedia(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userMovie: UserMovie,
) {
  const mediaStatus: MediaStatus =
    userMovie.status === "to_watch" ? "wishlist" : "done";
  const completedAt = userMovie.status === "watched" ? userMovie.last_watched_at : null;
  const completionMode = userMovie.status === "watched" ? "manual" : null;

  const { error } = await supabase
    .from("user_media")
    .upsert(
      {
        user_id: userMovie.user_id,
        media_id: userMovie.movie_id,
        status: mediaStatus,
        personal_rating: userMovie.personal_rating ?? null,
        added_at: userMovie.added_at,
        watchlisted_at: userMovie.watchlisted_at ?? null,
        last_watched_at: userMovie.last_watched_at ?? null,
        completed_at: completedAt ?? null,
        completion_mode: completionMode,
        updated_at: userMovie.updated_at,
      },
      { onConflict: "user_id,media_id" },
    );

  if (error) {
    throwDatabaseError("Failed to sync movie watch state to user_media.", error);
  }
}
