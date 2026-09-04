import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import type {
  Episode,
  EpisodeInsert,
  MediaItem,
  MediaItemInsert,
  MediaProviderMappingInsert,
  MediaStatus,
  MediaWatchActivityInsert,
  MediaWatchActivity,
  UserMedia,
  UserMediaInsert,
} from "@/lib/db/types";
import {
  validateRatingPayload,
  validateUuid,
  validateWatchActionPayload,
} from "@/lib/db/validation";
import type {
  TmdbMovieIngestPayload,
  TmdbShowIngestPayload,
} from "@/lib/providers/tmdb/adapters";
import {
  toTmdbShowIngestPayload,
} from "@/lib/providers/tmdb/adapters";
import type { TmdbTvDetails, TmdbTvSeasonDetails } from "@/lib/providers/tmdb/client";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { objectPayload } from "@/lib/utils/invariant";
import { queueTraktPushEvent } from "./sync";
import { upsertTag } from "./tags";

function shouldQueueOutboundSync(source: string | null | undefined) {
  return source !== "trakt_sync";
}

type MediaMovieWatchStatusResult = {
  userMedia: UserMedia;
  watchActivity: MediaWatchActivity | null;
};

type ShowSaveStatus = Extract<UserMedia["status"], "watching" | "done" | "stopped" | "wishlist">;
type EpisodeWatchPayload = {
  notes?: string | null;
  providerEventId?: string | null;
  source?: MediaWatchActivityInsert["source"];
  watchedAt?: string | null;
};

type ExistingMediaMappingRow = {
  media_id: string | null;
};

type ExistingEpisodeMappingRow = {
  episode_id: string | null;
  provider_id: string;
};

function buildUserMediaMovieStatusPayload({
  action,
  now,
  userId,
}: {
  action: ReturnType<typeof validateWatchActionPayload>;
  now: string;
  userId: string;
}): UserMediaInsert {
  const userMediaPayload: UserMediaInsert = {
    user_id: userId,
    media_id: action.movieId,
    status: action.status === "to_watch" ? "wishlist" : "done",
  };

  if (action.status === "watched") {
    userMediaPayload.last_watched_at = action.watchedAt;
    userMediaPayload.completed_at = action.watchedAt;
    userMediaPayload.completion_mode = "manual";
    userMediaPayload.watchlisted_at = null;
  } else {
    userMediaPayload.watchlisted_at = now;
    userMediaPayload.last_watched_at = null;
    userMediaPayload.completed_at = null;
    userMediaPayload.completion_mode = null;
  }

  if (Object.hasOwn(action, "personalRating")) {
    userMediaPayload.personal_rating = action.personalRating ?? null;
  }

  return userMediaPayload;
}

function requireWatchedAt(action: ReturnType<typeof validateWatchActionPayload>) {
  if (!action.watchedAt) {
    throwDatabaseError("Failed to update media watch status.", {
      message: "Validated watched media action did not include watchedAt.",
    });
  }

  return action.watchedAt;
}

function showMediaItemInsert(
  payload: TmdbShowIngestPayload["show"],
  existingMediaId: string | null,
  metadataTimestamp: string,
): MediaItemInsert {
  const row: MediaItemInsert = {
    type: "show",
    title: payload.title,
    original_title: payload.originalTitle,
    release_date: null,
    first_air_date: payload.firstAirDate,
    primary_genre_id: payload.primaryGenreId,
    primary_genre_name: payload.primaryGenreName,
    original_language: payload.originalLanguage,
    overview: payload.overview,
    poster_path: payload.posterPath,
    backdrop_path: payload.backdropPath,
    runtime_minutes: payload.runtimeMinutes,
    tmdb_vote_average: payload.tmdbVoteAverage,
    tmdb_vote_count: payload.tmdbVoteCount,
    popularity: payload.popularity,
    studio: payload.studio,
    network: payload.network,
    season_count: payload.seasonCount,
    episode_count: payload.episodeCount,
    metadata_updated_at: metadataTimestamp,
    tmdb_enriched_at: metadataTimestamp,
  };

  if (existingMediaId) {
    row.id = existingMediaId;
  }

  return row;
}

function episodeInsert(
  showId: string,
  episode: TmdbShowIngestPayload["episodes"][number],
  existingEpisodeId: string | null,
  metadataTimestamp: string,
): EpisodeInsert {
  const row: EpisodeInsert = {
    show_id: showId,
    season_number: episode.seasonNumber,
    episode_number: episode.episodeNumber,
    title: episode.title,
    air_date: episode.airDate,
    runtime_minutes: episode.runtimeMinutes,
    overview: episode.overview,
    poster_path: episode.posterPath,
    still_path: episode.stillPath,
    metadata_updated_at: metadataTimestamp,
  };

  if (existingEpisodeId) {
    row.id = existingEpisodeId;
  }

  return row;
}

function episodeKey(episode: Pick<Episode, "season_number" | "episode_number">) {
  return `${episode.season_number}:${episode.episode_number}`;
}

function payloadEpisodeKey(episode: TmdbShowIngestPayload["episodes"][number]) {
  return `${episode.seasonNumber}:${episode.episodeNumber}`;
}

export async function ingestTmdbShow(
  detail: TmdbTvDetails,
  seasons: TmdbTvSeasonDetails[] = [],
): Promise<MediaItem> {
  return ingestPreparedTmdbShow(toTmdbShowIngestPayload(detail, seasons));
}

export async function ingestPreparedTmdbShow(
  payload: TmdbShowIngestPayload,
): Promise<MediaItem> {
  const supabase = createSupabaseAdminClient();
  const metadataTimestamp = new Date().toISOString();
  const tmdbShowId = String(payload.show.tmdbId);

  const { data: existingMapping, error: existingMappingError } = await supabase
    .from("media_provider_mappings")
    .select("media_id")
    .eq("provider", "tmdb")
    .eq("provider_media_type", "show")
    .eq("provider_id", tmdbShowId)
    .maybeSingle();

  if (existingMappingError) {
    throwDatabaseError("Failed to resolve existing TMDB show mapping.", existingMappingError);
  }

  const existingMediaId = (existingMapping as ExistingMediaMappingRow | null)?.media_id ?? null;
  const { data: show, error: showError } = await supabase
    .from("media_items")
    .upsert(showMediaItemInsert(payload.show, existingMediaId, metadataTimestamp), {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (showError) {
    throwDatabaseError("Failed to ingest TMDB show metadata.", showError);
  }

  const showMapping: MediaProviderMappingInsert = {
    media_id: show.id,
    episode_id: null,
    provider: "tmdb",
    provider_media_type: "show",
    provider_id: tmdbShowId,
  };
  const { error: showMappingError } = await supabase
    .from("media_provider_mappings")
    .upsert(showMapping, { onConflict: "provider,provider_media_type,provider_id" });

  if (showMappingError) {
    throwDatabaseError("Failed to upsert TMDB show provider mapping.", showMappingError);
  }

  if (payload.episodes.length === 0) {
    return show as MediaItem;
  }

  const episodeProviderIds = payload.episodes.map((episode) => String(episode.tmdbId));
  const { data: existingEpisodeMappings, error: existingEpisodeMappingsError } = await supabase
    .from("media_provider_mappings")
    .select("episode_id, provider_id")
    .eq("provider", "tmdb")
    .eq("provider_media_type", "episode")
    .in("provider_id", episodeProviderIds);

  if (existingEpisodeMappingsError) {
    throwDatabaseError("Failed to resolve existing TMDB episode mappings.", existingEpisodeMappingsError);
  }

  const existingEpisodeIdByTmdbId = new Map(
    ((existingEpisodeMappings ?? []) as ExistingEpisodeMappingRow[])
      .filter((mapping) => mapping.episode_id)
      .map((mapping) => [mapping.provider_id, mapping.episode_id as string]),
  );
  const episodeRows = payload.episodes.map((episode) =>
    episodeInsert(
      show.id,
      episode,
      existingEpisodeIdByTmdbId.get(String(episode.tmdbId)) ?? null,
      metadataTimestamp,
    ),
  );
  const { data: episodes, error: episodesError } = await supabase
    .from("episodes")
    .upsert(episodeRows, { onConflict: "show_id,season_number,episode_number" })
    .select("*");

  if (episodesError) {
    throwDatabaseError("Failed to ingest TMDB episode metadata.", episodesError);
  }

  const episodeProviderIdByKey = new Map(
    payload.episodes.map((episode) => [payloadEpisodeKey(episode), String(episode.tmdbId)]),
  );
  const episodeMappingRows: MediaProviderMappingInsert[] = ((episodes ?? []) as Episode[])
    .flatMap((episode) => {
      const providerId = episodeProviderIdByKey.get(episodeKey(episode));

      if (!providerId) {
        return [];
      }

      return [
        {
          media_id: null,
          episode_id: episode.id,
          provider: "tmdb",
          provider_media_type: "episode",
          provider_id: providerId,
        } satisfies MediaProviderMappingInsert,
      ];
    });

  if (episodeMappingRows.length > 0) {
    const { error: episodeMappingError } = await supabase
      .from("media_provider_mappings")
      .upsert(episodeMappingRows, { onConflict: "provider,provider_media_type,provider_id" });

    if (episodeMappingError) {
      throwDatabaseError("Failed to upsert TMDB episode provider mappings.", episodeMappingError);
    }
  }

  return show as MediaItem;
}

export async function ingestPreparedTmdbMovieMedia(
  payload: TmdbMovieIngestPayload,
): Promise<MediaItem> {
  const supabase = createSupabaseAdminClient();
  const metadataTimestamp = new Date().toISOString();
  const tmdbMovieId = String(payload.movie.tmdbId);

  const { data: existingMapping, error: existingMappingError } = await supabase
    .from("media_provider_mappings")
    .select("media_id")
    .eq("provider", "tmdb")
    .eq("provider_media_type", "movie")
    .eq("provider_id", tmdbMovieId)
    .maybeSingle();

  if (existingMappingError) {
    throwDatabaseError("Failed to resolve existing TMDB movie mapping.", existingMappingError);
  }

  const existingMediaId = (existingMapping as ExistingMediaMappingRow | null)?.media_id ?? null;
  const movieMediaInsert: MediaItemInsert = {
    type: "movie",
    title: payload.movie.title,
    original_title: payload.movie.originalTitle ?? null,
    release_date: payload.movie.releaseDate ?? null,
    first_air_date: null,
    primary_genre_id: payload.movie.primaryGenreId ?? null,
    primary_genre_name: payload.movie.primaryGenreName ?? null,
    original_language: payload.movie.originalLanguage ?? null,
    overview: payload.movie.overview ?? null,
    poster_path: payload.movie.posterPath ?? null,
    backdrop_path: payload.movie.backdropPath ?? null,
    runtime_minutes: payload.movie.runtimeMinutes ?? null,
    tmdb_vote_average: payload.movie.tmdbVoteAverage ?? null,
    tmdb_vote_count: payload.movie.tmdbVoteCount ?? null,
    popularity: payload.movie.popularity ?? null,
    metadata_updated_at: metadataTimestamp,
    tmdb_enriched_at: metadataTimestamp,
  };

  if (existingMediaId) {
    movieMediaInsert.id = existingMediaId;
  }

  const { data: mediaItem, error: mediaItemError } = await supabase
    .from("media_items")
    .upsert(movieMediaInsert, { onConflict: "id" })
    .select("*")
    .single();

  if (mediaItemError) {
    throwDatabaseError("Failed to ingest TMDB movie media metadata.", mediaItemError);
  }

  const mappingRows: MediaProviderMappingInsert[] = [
    {
      media_id: mediaItem.id,
      episode_id: null,
      provider: "tmdb",
      provider_media_type: "movie",
      provider_id: tmdbMovieId,
    },
  ];

  if (payload.movie.imdbId) {
    mappingRows.push({
      media_id: mediaItem.id,
      episode_id: null,
      provider: "imdb",
      provider_media_type: "movie",
      provider_id: payload.movie.imdbId,
    });
  }

  const { error: mappingError } = await supabase
    .from("media_provider_mappings")
    .upsert(mappingRows, { onConflict: "provider,provider_media_type,provider_id" });

  if (mappingError) {
    throwDatabaseError("Failed to upsert TMDB movie provider mappings.", mappingError);
  }

  return mediaItem as MediaItem;
}

export async function setMediaShowStatus(
  showId: string,
  status: ShowSaveStatus,
): Promise<UserMedia> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(showId, "showId");
  const now = new Date().toISOString();

  const { data: show, error: showError } = await supabase
    .from("media_items")
    .select("id, type")
    .eq("id", id)
    .eq("type", "show")
    .maybeSingle();

  if (showError) {
    throwDatabaseError("Failed to load show media item.", showError);
  }

  if (!show) {
    throwNotFound("Show was not found.");
  }

  const latestWatchedAt =
    status === "wishlist"
      ? null
      : await getLatestShowWatchActivityTimestamp({
          mediaId: id,
          userId: user.id,
        });
  const manualCompletedAt = status === "done" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("user_media")
    .upsert(
      {
        user_id: user.id,
        media_id: id,
        status,
        watchlisted_at: status === "wishlist" ? now : null,
        last_watched_at: status === "wishlist" ? null : latestWatchedAt ?? manualCompletedAt,
        completed_at: manualCompletedAt,
        completion_mode: status === "done" ? "manual" : null,
      },
      { onConflict: "user_id,media_id" },
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to save show state.", error);
  }

  if (status === "wishlist") {
    await queueTraktPushEvent("show.add_to_watchlist", {
      showId: id,
      userMediaId: data.id,
      watchlistedAt: data.watchlisted_at ?? now,
    });
  }

  return data as UserMedia;
}

export async function removeUserMediaShow(showId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(showId, "showId");

  const { data: existingUserMedia, error: existingUserMediaError } = await supabase
    .from("user_media")
    .select("*")
    .eq("user_id", user.id)
    .eq("media_id", id)
    .maybeSingle();

  if (existingUserMediaError) {
    throwDatabaseError("Failed to load existing show state.", existingUserMediaError);
  }

  const { error } = await supabase
    .from("user_media")
    .delete()
    .eq("user_id", user.id)
    .eq("media_id", id);

  if (error) {
    throwDatabaseError("Failed to remove show from library.", error);
  }

  if (existingUserMedia?.status === "wishlist") {
    await queueTraktPushEvent("show.remove_from_watchlist", {
      showId: id,
      userMediaId: existingUserMedia.id,
    });
  }
}

async function refreshMovieMediaLastWatchedAt({
  mediaId,
  requireExisting = true,
  userId,
}: {
  mediaId: string;
  requireExisting?: boolean;
  userId: string;
}): Promise<UserMedia | null> {
  const supabase = await createSupabaseServerClient();

  const { data: latestActivity, error: latestActivityError } = await supabase
    .from("media_watch_activity")
    .select("watched_at")
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .order("watched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestActivityError) {
    throwDatabaseError("Failed to load latest media watch activity.", latestActivityError);
  }

  const latestWatchedAt = latestActivity?.watched_at ?? null;
  const { data: userMedia, error: userMediaError } = await supabase
    .from("user_media")
    .update({
      completed_at: latestWatchedAt,
      completion_mode: latestWatchedAt ? "manual" : null,
      last_watched_at: latestWatchedAt,
    })
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .select("*")
    .maybeSingle();

  if (userMediaError) {
    throwDatabaseError("Failed to refresh media watch state.", userMediaError);
  }

  if (!userMedia && requireExisting) {
    throwNotFound("Media item is not in the user's library.");
  }

  return userMedia ?? null;
}

async function requireEpisodeForShow({
  episodeId,
  showId,
}: {
  episodeId: string;
  showId: string;
}): Promise<Episode> {
  const supabase = await createSupabaseServerClient();

  const { data: show, error: showError } = await supabase
    .from("media_items")
    .select("id, type")
    .eq("id", showId)
    .eq("type", "show")
    .maybeSingle();

  if (showError) {
    throwDatabaseError("Failed to load show media item.", showError);
  }

  if (!show) {
    throwNotFound("Show was not found.");
  }

  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .eq("show_id", showId)
    .maybeSingle();

  if (episodeError) {
    throwDatabaseError("Failed to load episode.", episodeError);
  }

  if (!episode) {
    throwNotFound("Episode was not found.");
  }

  return episode as Episode;
}

async function refreshShowMediaLastWatchedAt({
  mediaId,
  userId,
}: {
  mediaId: string;
  userId: string;
}): Promise<UserMedia> {
  const supabase = await createSupabaseServerClient();

  const [
    currentResult,
    latestWatchedAt,
    autoCompletion,
  ] = await Promise.all([
    supabase
      .from("user_media")
      .select("*")
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .maybeSingle(),
    getLatestShowWatchActivityTimestamp({ mediaId, userId }),
    getShowAutoCompletionState({ mediaId, userId }),
  ]);

  if (currentResult.error) {
    console.error("[refreshShowMediaLastWatchedAt] user_media query failed", { mediaId, userId, error: currentResult.error });
    throwDatabaseError("Failed to load current show watch state.", currentResult.error);
  }

  const currentUserMedia = (currentResult.data as UserMedia | null) ?? null;
  const isManualCompletion =
    currentUserMedia?.status === "done" &&
    currentUserMedia.completion_mode === "manual";
  const completedAt = autoCompletion.isComplete
    ? autoCompletion.completedAt
    : isManualCompletion
      ? currentUserMedia.completed_at
      : null;
  const status: MediaStatus = autoCompletion.isComplete || isManualCompletion
    ? "done"
    : currentUserMedia?.status === "wishlist" ||
        currentUserMedia?.status === "done" ||
        currentUserMedia?.status === "stopped" ||
        currentUserMedia?.status === undefined
      ? "watching"
      : currentUserMedia.status;
  const completionMode = autoCompletion.isComplete
    ? "auto_all_aired"
    : isManualCompletion
      ? "manual"
      : null;

  const { data: userMedia, error: userMediaError } = await supabase
    .from("user_media")
    .upsert(
      {
        completed_at: completedAt,
        completion_mode: completionMode,
        last_watched_at: latestWatchedAt ?? currentUserMedia?.last_watched_at ?? null,
        media_id: mediaId,
        status,
        user_id: userId,
        watchlisted_at: null,
      },
      { onConflict: "user_id,media_id" },
    )
    .select("*")
    .single();

  if (userMediaError) {
    throwDatabaseError("Failed to refresh show watch state.", userMediaError);
  }

  return userMedia as UserMedia;
}

/**
 * Recompute a show's completion state for the current user, but only when the
 * show is already in their library. Used after lazy TMDB hydration ingests new
 * seasons so an auto-completed show with freshly-added unwatched aired episodes
 * moves back to "watching" without waiting for the next episode toggle. Never
 * creates a user_media row for an untracked show.
 */
export async function refreshShowCompletionStateIfTracked(
  showId: string,
): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(showId, "showId");

  const { data: existing, error } = await supabase
    .from("user_media")
    .select("media_id")
    .eq("user_id", user.id)
    .eq("media_id", id)
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to check show tracking state.", error);
  }

  if (!existing) {
    return;
  }

  await refreshShowMediaLastWatchedAt({ mediaId: id, userId: user.id });
}

async function getLatestShowWatchActivityTimestamp({
  mediaId,
  userId,
}: {
  mediaId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: latestActivity, error } = await supabase
    .from("media_watch_activity")
    .select("watched_at")
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .order("watched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to load latest show watch activity.", error);
  }

  return latestActivity?.watched_at ?? null;
}

async function getShowAutoCompletionState({
  mediaId,
  userId,
}: {
  mediaId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  // Include episodes with no air_date (treat as aired) alongside those with air_date <= today.
  // Future-dated episodes already in the DB are still excluded, which correctly keeps
  // in-progress shows from auto-completing while there are unwatched upcoming episodes.
  const { data: episodes, error: episodesError } = await supabase
    .from("episodes")
    .select("id")
    .eq("show_id", mediaId)
    .neq("season_number", 0)
    .or(`air_date.is.null,air_date.lte.${today}`);

  if (episodesError) {
    console.error("[getShowAutoCompletionState] episodes query failed", { mediaId, userId, error: episodesError });
    throwDatabaseError("Failed to load aired show episodes.", episodesError);
  }

  const airedEpisodeIds = ((episodes ?? []) as Pick<Episode, "id">[]).map((episode) => episode.id);

  if (airedEpisodeIds.length === 0) {
    return { completedAt: null, isComplete: false };
  }

  const { data: watchedRows, error: watchedRowsError } = await supabase
    .from("media_watch_activity")
    .select("episode_id, watched_at")
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .in("episode_id", airedEpisodeIds)
    .order("watched_at", { ascending: false });

  if (watchedRowsError) {
    console.error("[getShowAutoCompletionState] watch activity query failed", { mediaId, userId, error: watchedRowsError });
    throwDatabaseError("Failed to load aired show watch activity.", watchedRowsError);
  }

  const watchedEpisodeIds = new Set(
    ((watchedRows ?? []) as Pick<MediaWatchActivity, "episode_id">[])
      .flatMap((row) => row.episode_id ? [row.episode_id] : []),
  );
  const isComplete = airedEpisodeIds.every((episodeId) => watchedEpisodeIds.has(episodeId));

  return {
    completedAt: isComplete
      ? ((watchedRows ?? []) as Pick<MediaWatchActivity, "watched_at">[])[0]?.watched_at ?? null
      : null,
    isComplete,
  };
}

function buildEpisodeWatchActivityInsert({
  episodeId,
  mediaId,
  payload,
  userId,
  watchedAt,
}: {
  episodeId: string;
  mediaId: string;
  payload: EpisodeWatchPayload;
  userId: string;
  watchedAt: string;
}): MediaWatchActivityInsert {
  return {
    episode_id: episodeId,
    media_id: mediaId,
    notes: payload.notes ?? null,
    provider_event_id: payload.providerEventId ?? null,
    source: payload.source ?? "manual",
    user_id: userId,
    watched_at: watchedAt,
  };
}

export async function markMediaEpisodeWatched(
  showId: string,
  episodeId: string,
  payload: EpisodeWatchPayload = {},
): Promise<{
  userMedia: UserMedia;
  watchActivity: MediaWatchActivity;
}> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const mediaId = validateUuid(showId, "showId");
  const id = validateUuid(episodeId, "episodeId");
  await requireEpisodeForShow({ episodeId: id, showId: mediaId });
  const watchedAt = payload.watchedAt ?? new Date().toISOString();

  const { data: watchActivity, error: watchActivityError } = await supabase
    .from("media_watch_activity")
    .insert(
      buildEpisodeWatchActivityInsert({
        episodeId: id,
        mediaId,
        payload,
        userId: user.id,
        watchedAt,
      }),
    )
    .select("*")
    .single();

  if (watchActivityError) {
    throwDatabaseError("Failed to mark episode watched.", watchActivityError);
  }

  const userMedia = await refreshShowMediaLastWatchedAt({
    mediaId,
    userId: user.id,
  });

  if (shouldQueueOutboundSync(payload.source)) {
    await queueTraktPushEvent("episode.mark_watched", {
      episodeId: id,
      showId: mediaId,
      userMediaId: userMedia.id,
      watchActivityId: watchActivity.id,
      watchedAt,
    });
  }

  return {
    userMedia,
    watchActivity: watchActivity as MediaWatchActivity,
  };
}

export async function markMediaSeasonWatched(
  showId: string,
  seasonNumber: number,
): Promise<UserMedia> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const mediaId = validateUuid(showId, "showId");

  if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
    throwDatabaseError("Failed to mark season watched.", {
      message: "Season number must be a non-negative integer.",
    });
  }

  const { data: show, error: showError } = await supabase
    .from("media_items")
    .select("id, type")
    .eq("id", mediaId)
    .eq("type", "show")
    .maybeSingle();

  if (showError) {
    throwDatabaseError("Failed to load show media item.", showError);
  }

  if (!show) {
    throwNotFound("Show was not found.");
  }

  const { data: episodes, error: episodesError } = await supabase
    .from("episodes")
    .select("id")
    .eq("show_id", mediaId)
    .eq("season_number", seasonNumber);

  if (episodesError) {
    throwDatabaseError("Failed to load season episodes.", episodesError);
  }

  const episodeIds = ((episodes ?? []) as Pick<Episode, "id">[]).map((episode) => episode.id);

  if (episodeIds.length === 0) {
    throwNotFound("Season has no episodes.");
  }

  const { data: existingActivity, error: existingActivityError } = await supabase
    .from("media_watch_activity")
    .select("episode_id")
    .eq("user_id", user.id)
    .eq("media_id", mediaId)
    .in("episode_id", episodeIds);

  if (existingActivityError) {
    throwDatabaseError("Failed to load season watch activity.", existingActivityError);
  }

  const watchedEpisodeIds = new Set(
    ((existingActivity ?? []) as Pick<MediaWatchActivity, "episode_id">[])
      .flatMap((activity) => activity.episode_id ? [activity.episode_id] : []),
  );
  const watchedAt = new Date().toISOString();
  const rows: Array<MediaWatchActivityInsert & { episode_id: string }> = episodeIds
    .filter((episodeId) => !watchedEpisodeIds.has(episodeId))
    .map((episodeId) => ({
      episode_id: episodeId,
      media_id: mediaId,
      notes: null,
      provider_event_id: null,
      source: "manual",
      user_id: user.id,
      watched_at: watchedAt,
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("media_watch_activity")
      .insert(rows);

    if (insertError) {
      throwDatabaseError("Failed to mark season watched.", insertError);
    }

    await Promise.all(
      rows.map((row) =>
        queueTraktPushEvent("episode.mark_watched", {
          episodeId: row.episode_id,
          showId: mediaId,
          watchedAt,
        }),
      ),
    );
  }

  return refreshShowMediaLastWatchedAt({
    mediaId,
    userId: user.id,
  });
}

export async function markMediaEpisodeUnwatched(
  showId: string,
  episodeId: string,
): Promise<UserMedia> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const mediaId = validateUuid(showId, "showId");
  const id = validateUuid(episodeId, "episodeId");
  await requireEpisodeForShow({ episodeId: id, showId: mediaId });

  const { error } = await supabase
    .from("media_watch_activity")
    .delete()
    .eq("user_id", user.id)
    .eq("media_id", mediaId)
    .eq("episode_id", id);

  if (error) {
    throwDatabaseError("Failed to mark episode unwatched.", error);
  }

  await queueTraktPushEvent("episode.remove_from_history", {
    episodeId: id,
    showId: mediaId,
  });

  return refreshShowMediaLastWatchedAt({
    mediaId,
    userId: user.id,
  });
}

export async function addMediaEpisodeWatchDate(
  showId: string,
  episodeId: string,
  payload: EpisodeWatchPayload,
): Promise<{
  userMedia: UserMedia;
  watchActivity: MediaWatchActivity;
}> {
  if (!payload.watchedAt) {
    throwDatabaseError("Failed to append episode watch date.", {
      message: "Episode watch date did not include watchedAt.",
    });
  }

  return markMediaEpisodeWatched(showId, episodeId, payload);
}

export async function deleteMediaEpisodeWatchActivity(
  showId: string,
  episodeId: string,
  activityId: string,
): Promise<UserMedia> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const mediaId = validateUuid(showId, "showId");
  const episode = validateUuid(episodeId, "episodeId");
  const id = validateUuid(activityId, "activityId");

  const { error } = await supabase
    .from("media_watch_activity")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("media_id", mediaId)
    .eq("episode_id", episode);

  if (error) {
    throwDatabaseError("Failed to delete episode watch activity.", error);
  }

  return refreshShowMediaLastWatchedAt({
    mediaId,
    userId: user.id,
  });
}

export async function updateMediaEpisodeWatchActivityDate(
  showId: string,
  episodeId: string,
  activityId: string,
  watchedAt: string,
): Promise<UserMedia> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const mediaId = validateUuid(showId, "showId");
  const episode = validateUuid(episodeId, "episodeId");
  const id = validateUuid(activityId, "activityId");

  const { error } = await supabase
    .from("media_watch_activity")
    .update({ watched_at: watchedAt })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("media_id", mediaId)
    .eq("episode_id", episode);

  if (error) {
    throwDatabaseError("Failed to update episode watch activity.", error);
  }

  return refreshShowMediaLastWatchedAt({
    mediaId,
    userId: user.id,
  });
}

export async function setMediaMovieWatchStatus(
  payload: unknown,
): Promise<MediaMovieWatchStatusResult> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const action = validateWatchActionPayload(payload);
  const now = new Date().toISOString();

  const { data: initialUserMedia, error: userMediaError } = await supabase
    .from("user_media")
    .upsert(
      buildUserMediaMovieStatusPayload({
        action,
        now,
        userId: user.id,
      }),
      { onConflict: "user_id,media_id" },
    )
    .select("*")
    .single();

  if (userMediaError) {
    throwDatabaseError("Failed to update media watch status.", userMediaError);
  }

  if (action.status === "to_watch") {
    if (shouldQueueOutboundSync(action.source)) {
      await queueTraktPushEvent("movie.add_to_watchlist", {
        movieId: action.movieId,
        userMovieId: initialUserMedia.id,
        watchlistedAt: initialUserMedia.watchlisted_at ?? now,
      });
    }

    return {
      userMedia: initialUserMedia,
      watchActivity: null,
    };
  }

  const watchedAt = requireWatchedAt(action);
  const { data: watchActivity, error: watchActivityError } = await supabase
    .from("media_watch_activity")
    .insert({
      media_id: action.movieId,
      notes: action.notes ?? null,
      provider_event_id: action.providerEventId ?? null,
      source: action.source ?? "manual",
      user_id: user.id,
      watched_at: watchedAt,
    })
    .select("*")
    .single();

  if (watchActivityError) {
    throwDatabaseError("Failed to append media watch activity.", watchActivityError);
  }

  const userMedia = await refreshMovieMediaLastWatchedAt({
    mediaId: action.movieId,
    userId: user.id,
  });

  if (!userMedia) {
    throwNotFound("Media item is not in the user's library.");
  }

  if (shouldQueueOutboundSync(action.source)) {
    await queueTraktPushEvent("movie.mark_watched", {
      movieId: action.movieId,
      userMovieId: userMedia.id,
      watchLogId: watchActivity.id,
      watchedAt,
      personalRating: Object.hasOwn(action, "personalRating")
        ? (action.personalRating ?? null)
        : null,
    });
  }

  return {
    userMedia,
    watchActivity,
  };
}

export async function addMediaMovieWatchDate(
  movieId: string,
  payload: unknown,
): Promise<{
  userMedia: UserMedia;
  watchActivity: MediaWatchActivity;
}> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(movieId, "movieId");
  const action = validateWatchActionPayload({
    ...objectPayload(payload),
    movieId: id,
    status: "watched",
  });
  const now = new Date().toISOString();
  const watchedAt = requireWatchedAt(action);

  const { error: userMediaError } = await supabase
    .from("user_media")
    .upsert(
      buildUserMediaMovieStatusPayload({
        action,
        now,
        userId: user.id,
      }),
      { onConflict: "user_id,media_id" },
    );

  if (userMediaError) {
    throwDatabaseError("Failed to update media watch status.", userMediaError);
  }

  const { data: watchActivity, error: watchActivityError } = await supabase
    .from("media_watch_activity")
    .insert({
      media_id: id,
      notes: action.notes ?? null,
      provider_event_id: action.providerEventId ?? null,
      source: action.source ?? "manual",
      user_id: user.id,
      watched_at: watchedAt,
    })
    .select("*")
    .single();

  if (watchActivityError) {
    throwDatabaseError("Failed to append media watch activity.", watchActivityError);
  }

  const userMedia = await refreshMovieMediaLastWatchedAt({
    mediaId: id,
    userId: user.id,
  });

  if (!userMedia) {
    throwNotFound("Media item is not in the user's library.");
  }

  if (shouldQueueOutboundSync(action.source)) {
    await queueTraktPushEvent("movie.add_watch_date", {
      movieId: id,
      userMovieId: userMedia.id,
      watchLogId: watchActivity.id,
      watchedAt,
    });
  }

  return {
    userMedia,
    watchActivity,
  };
}

export async function removeUserMediaMovie(movieId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(movieId, "movieId");

  const { data: existingUserMedia, error: existingUserMediaError } = await supabase
    .from("user_media")
    .select("*")
    .eq("user_id", user.id)
    .eq("media_id", id)
    .maybeSingle();

  if (existingUserMediaError) {
    throwDatabaseError("Failed to load existing media watch state.", existingUserMediaError);
  }

  const { error } = await supabase
    .from("user_media")
    .delete()
    .eq("user_id", user.id)
    .eq("media_id", id);

  if (error) {
    throwDatabaseError("Failed to remove media from library.", error);
  }

  if (existingUserMedia?.status === "wishlist") {
    await queueTraktPushEvent("movie.remove_from_watchlist", {
      movieId: id,
      userMovieId: existingUserMedia.id,
    });
  } else if (existingUserMedia?.status === "done") {
    await queueTraktPushEvent("movie.remove_from_library", {
      movieId: id,
      userMovieId: existingUserMedia.id,
    });
  }
}

type MediaRatingSyncSpec = {
  idKey: string;
  userIdKey: string;
  setEvent: string;
  clearEvent: string;
  notFoundMessage: string;
};

async function updateMediaRating(
  mediaId: string,
  idLabel: string,
  payload: unknown,
  spec: MediaRatingSyncSpec,
): Promise<UserMedia> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(mediaId, idLabel);
  const rating = validateRatingPayload(payload);

  const { data, error } = await supabase
    .from("user_media")
    .update({ personal_rating: rating.personalRating })
    .eq("user_id", user.id)
    .eq("media_id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to update media rating.", error);
  }

  if (!data) {
    throwNotFound(spec.notFoundMessage);
  }

  await queueTraktPushEvent(
    rating.personalRating === null ? spec.clearEvent : spec.setEvent,
    {
      [spec.idKey]: id,
      [spec.userIdKey]: data.id,
      personalRating: rating.personalRating,
    },
  );

  return data;
}

export async function updateMediaMovieRating(
  movieId: string,
  payload: unknown,
): Promise<UserMedia> {
  return updateMediaRating(movieId, "movieId", payload, {
    idKey: "movieId",
    userIdKey: "userMovieId",
    setEvent: "movie.rating.set",
    clearEvent: "movie.rating.clear",
    notFoundMessage: "Media item is not in the user's library.",
  });
}

export async function updateMediaShowRating(
  showId: string,
  payload: unknown,
): Promise<UserMedia> {
  return updateMediaRating(showId, "showId", payload, {
    idKey: "showId",
    userIdKey: "userMediaId",
    setEvent: "show.rating.set",
    clearEvent: "show.rating.clear",
    notFoundMessage: "Show is not in the user's library.",
  });
}

async function attachTagToMedia(mediaId: string, tagId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedMediaId = validateUuid(mediaId, "mediaId");
  const validatedTagId = validateUuid(tagId, "tagId");

  const { data, error } = await supabase
    .from("user_media_tags")
    .upsert(
      {
        user_id: user.id,
        media_id: validatedMediaId,
        tag_id: validatedTagId,
      },
      { onConflict: "user_id,media_id,tag_id" },
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to attach tag to media.", error);
  }

  return data;
}

async function detachTagFromMedia(mediaId: string, tagId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedMediaId = validateUuid(mediaId, "mediaId");
  const validatedTagId = validateUuid(tagId, "tagId");

  const { error } = await supabase
    .from("user_media_tags")
    .delete()
    .eq("user_id", user.id)
    .eq("media_id", validatedMediaId)
    .eq("tag_id", validatedTagId);

  if (error) {
    throwDatabaseError("Failed to detach tag from media.", error);
  }

  return { validatedMediaId, validatedTagId };
}

export async function attachTagToMediaMovie(movieId: string, tagId: string) {
  return attachTagToMedia(movieId, tagId);
}

export async function createAndAttachTagToMediaMovie(movieId: string, payload: unknown) {
  const tag = await upsertTag(payload);
  const userMediaTag = await attachTagToMedia(movieId, tag.id);

  await queueTraktPushEvent("movie.tag.add", {
    movieId,
    tagId: tag.id,
    tagName: tag.name,
  });

  return { tag, userMediaTag };
}

export async function detachTagFromMediaMovie(movieId: string, tagId: string) {
  const { validatedMediaId, validatedTagId } = await detachTagFromMedia(movieId, tagId);

  await queueTraktPushEvent("movie.tag.remove", {
    movieId: validatedMediaId,
    tagId: validatedTagId,
  });
}

export async function attachTagToMediaShow(showId: string, tagId: string) {
  return attachTagToMedia(showId, tagId);
}

export async function createAndAttachTagToMediaShow(showId: string, payload: unknown) {
  const tag = await upsertTag(payload);
  const userMediaTag = await attachTagToMedia(showId, tag.id);

  return { tag, userMediaTag };
}

export async function detachTagFromMediaShow(showId: string, tagId: string) {
  await detachTagFromMedia(showId, tagId);
}

export async function deleteMediaMovieWatchActivity(
  movieId: string,
  activityId: string,
): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(activityId, "activityId");
  const mediaId = validateUuid(movieId, "movieId");

  const { error } = await supabase
    .from("media_watch_activity")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("media_id", mediaId);

  if (error) {
    throwDatabaseError("Failed to delete media watch activity.", error);
  }

  await refreshMovieMediaLastWatchedAt({
    mediaId,
    requireExisting: false,
    userId: user.id,
  });
}

export async function updateMediaMovieWatchActivityDate(
  movieId: string,
  activityId: string,
  watchedAt: string,
): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(activityId, "activityId");
  const mediaId = validateUuid(movieId, "movieId");

  const { error } = await supabase
    .from("media_watch_activity")
    .update({ watched_at: watchedAt })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("media_id", mediaId);

  if (error) {
    throwDatabaseError("Failed to update media watch activity.", error);
  }

  await refreshMovieMediaLastWatchedAt({
    mediaId,
    requireExisting: false,
    userId: user.id,
  });
}
