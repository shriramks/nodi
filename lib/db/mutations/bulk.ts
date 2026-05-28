import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { validateRatingPayload, validateUuid } from "@/lib/db/validation";
import type { UserMediaInsert } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSyncEvent } from "./sync";
import { upsertTag } from "./tags";

type TraktSyncPayload = Record<string, unknown>;

async function queueTraktSyncEvent(eventType: string, payload: TraktSyncPayload) {
  await createSyncEvent({
    provider: "trakt",
    direction: "push",
    eventType,
    status: "pending",
    payload,
  });
}

export async function bulkUpdateRating(movieIds: string[], ratingPayload: unknown): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedIds = movieIds.map((id) => validateUuid(id, "movieId"));
  const rating = validateRatingPayload(ratingPayload);

  const { error } = await supabase
    .from("user_media")
    .update({ personal_rating: rating.personalRating })
    .eq("user_id", user.id)
    .in("media_id", validatedIds);

  if (error) {
    throwDatabaseError("Failed to update ratings.", error);
  }

  for (const movieId of validatedIds) {
    await queueTraktSyncEvent(
      rating.personalRating === null ? "movie.rating.clear" : "movie.rating.set",
      { movieId, personalRating: rating.personalRating },
    );
  }
}

export async function bulkSetWatchStatus(
  movieIds: string[],
  status: "watched" | "to_watch",
): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedIds = movieIds.map((id) => validateUuid(id, "movieId"));
  const now = new Date().toISOString();

  for (const movieId of validatedIds) {
    const userMediaPayload: UserMediaInsert = {
      user_id: user.id,
      media_id: movieId,
      status: status === "watched" ? "done" : "wishlist",
      last_watched_at: status === "watched" ? now : null,
      completed_at: status === "watched" ? now : null,
      completion_mode: status === "watched" ? "manual" : null,
      watchlisted_at: status === "to_watch" ? now : null,
    };

    const { data: userMedia, error: userMediaError } = await supabase
      .from("user_media")
      .upsert(userMediaPayload, { onConflict: "user_id,media_id" })
      .select("id")
      .single();

    if (userMediaError) {
      throwDatabaseError("Failed to update movie watch status.", userMediaError);
    }

    if (status === "watched") {
      const { error: activityError } = await supabase.from("media_watch_activity").insert({
        user_id: user.id,
        media_id: movieId,
        watched_at: now,
        source: "manual",
        notes: null,
        provider_event_id: null,
      });

      if (activityError) {
        throwDatabaseError("Failed to append watch activity.", activityError);
      }

      await queueTraktSyncEvent("movie.mark_watched", {
        movieId,
        userMovieId: userMedia.id,
        watchedAt: now,
      });
    } else {
      await queueTraktSyncEvent("movie.add_to_watchlist", {
        movieId,
        userMovieId: userMedia.id,
      });
    }
  }
}

export async function bulkCreateAndAttachTag(movieIds: string[], tagName: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedIds = movieIds.map((id) => validateUuid(id, "movieId"));

  const tag = await upsertTag({ name: tagName });

  const rows = validatedIds.map((movieId) => ({
    user_id: user.id,
    media_id: movieId,
    tag_id: tag.id,
  }));

  const { error } = await supabase
    .from("user_media_tags")
    .upsert(rows, { onConflict: "user_id,media_id,tag_id" });

  if (error) {
    throwDatabaseError("Failed to attach tag to movies.", error);
  }

  for (const movieId of validatedIds) {
    await queueTraktSyncEvent("movie.tag.add", { movieId, tagId: tag.id, tagName: tag.name });
  }
}

export async function bulkAttachTagToMovies(movieIds: string[], tagId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedIds = movieIds.map((id) => validateUuid(id, "movieId"));
  const validatedTagId = validateUuid(tagId, "tagId");

  const rows = validatedIds.map((movieId) => ({
    user_id: user.id,
    media_id: movieId,
    tag_id: validatedTagId,
  }));

  const { error } = await supabase
    .from("user_media_tags")
    .upsert(rows, { onConflict: "user_id,media_id,tag_id" });

  if (error) {
    throwDatabaseError("Failed to attach tag to movies.", error);
  }

  for (const movieId of validatedIds) {
    await queueTraktSyncEvent("movie.tag.add", { movieId, tagId: validatedTagId });
  }
}

export async function bulkDetachTagFromMovies(movieIds: string[], tagId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedIds = movieIds.map((id) => validateUuid(id, "movieId"));
  const validatedTagId = validateUuid(tagId, "tagId");

  const { error } = await supabase
    .from("user_media_tags")
    .delete()
    .eq("user_id", user.id)
    .eq("tag_id", validatedTagId)
    .in("media_id", validatedIds);

  if (error) {
    throwDatabaseError("Failed to detach tag from movies.", error);
  }

  for (const movieId of validatedIds) {
    await queueTraktSyncEvent("movie.tag.remove", { movieId, tagId: validatedTagId });
  }
}
