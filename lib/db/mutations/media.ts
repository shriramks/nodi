import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import {
  shouldQueueOutboundSync,
} from "@/lib/db/mutations/movie-state";
import type {
  Json,
  MediaWatchActivity,
  UserMedia,
  UserMediaInsert,
} from "@/lib/db/types";
import {
  validateRatingPayload,
  validateUuid,
  validateWatchActionPayload,
} from "@/lib/db/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSyncEvent } from "./sync";
import { upsertTag } from "./tags";

type TraktSyncPayload = Record<string, Json>;

type MediaMovieWatchStatusResult = {
  userMedia: UserMedia;
  watchActivity: MediaWatchActivity | null;
};

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

async function queueTraktSyncEvent(eventType: string, payload: TraktSyncPayload) {
  await createSyncEvent({
    provider: "trakt",
    direction: "push",
    eventType,
    status: "pending",
    payload,
  });
}

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
    status: action.status === "to_watch" ? "wishlist" : "watched",
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
      await queueTraktSyncEvent("movie.add_to_watchlist", {
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
    await queueTraktSyncEvent("movie.mark_watched", {
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
    await queueTraktSyncEvent("movie.add_watch_date", {
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
    await queueTraktSyncEvent("movie.remove_from_watchlist", {
      movieId: id,
      userMovieId: existingUserMedia.id,
    });
  } else if (existingUserMedia?.status === "watched") {
    await queueTraktSyncEvent("movie.remove_from_library", {
      movieId: id,
      userMovieId: existingUserMedia.id,
    });
  }
}

export async function updateMediaMovieRating(
  movieId: string,
  payload: unknown,
): Promise<UserMedia> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(movieId, "movieId");
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
    throwNotFound("Media item is not in the user's library.");
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

export async function attachTagToMediaMovie(movieId: string, tagId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedMovieId = validateUuid(movieId, "movieId");
  const validatedTagId = validateUuid(tagId, "tagId");

  const { data, error } = await supabase
    .from("user_media_tags")
    .upsert(
      {
        user_id: user.id,
        media_id: validatedMovieId,
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

export async function createAndAttachTagToMediaMovie(movieId: string, payload: unknown) {
  const tag = await upsertTag(payload);
  const userMediaTag = await attachTagToMediaMovie(movieId, tag.id);

  await queueTraktSyncEvent("movie.tag.add", {
    movieId,
    tagId: tag.id,
    tagName: tag.name,
  });

  return {
    tag,
    userMediaTag,
  };
}

export async function detachTagFromMediaMovie(movieId: string, tagId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedMovieId = validateUuid(movieId, "movieId");
  const validatedTagId = validateUuid(tagId, "tagId");

  const { error } = await supabase
    .from("user_media_tags")
    .delete()
    .eq("user_id", user.id)
    .eq("media_id", validatedMovieId)
    .eq("tag_id", validatedTagId);

  if (error) {
    throwDatabaseError("Failed to detach tag from media.", error);
  }

  await queueTraktSyncEvent("movie.tag.remove", {
    movieId: validatedMovieId,
    tagId: validatedTagId,
  });
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
