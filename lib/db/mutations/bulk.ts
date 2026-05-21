import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { validateRatingPayload, validateUuid } from "@/lib/db/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSyncEvent } from "./sync";
import { upsertTag } from "./tags";
import { buildUserMovieStatusPayload } from "./movie-state";
import type { Json } from "@/lib/db/types";

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

export async function bulkUpdateRating(movieIds: string[], ratingPayload: unknown): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedIds = movieIds.map((id) => validateUuid(id, "movieId"));
  const rating = validateRatingPayload(ratingPayload);

  const { error } = await supabase
    .from("user_movies")
    .update({ personal_rating: rating.personalRating })
    .eq("user_id", user.id)
    .in("movie_id", validatedIds);

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
    const action = { movieId, status, watchedAt: status === "watched" ? now : undefined, source: "manual" as const };
    const userMoviePayload = buildUserMovieStatusPayload({ action, now, userId: user.id });

    const { data: userMovie, error: userMovieError } = await supabase
      .from("user_movies")
      .upsert(userMoviePayload, { onConflict: "user_id,movie_id" })
      .select("*")
      .single();

    if (userMovieError) {
      throwDatabaseError("Failed to update movie watch status.", userMovieError);
    }

    if (status === "watched") {
      const { error: watchLogError } = await supabase.from("watch_logs").insert({
        user_id: user.id,
        movie_id: movieId,
        watched_at: now,
        source: "manual",
      });

      if (watchLogError) {
        throwDatabaseError("Failed to append watch log.", watchLogError);
      }

      await queueTraktSyncEvent("movie.mark_watched", {
        movieId,
        userMovieId: userMovie.id,
        watchedAt: now,
      });
    } else {
      await queueTraktSyncEvent("movie.add_to_watchlist", {
        movieId,
        userMovieId: userMovie.id,
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
    movie_id: movieId,
    tag_id: tag.id,
  }));

  const { error } = await supabase
    .from("user_movie_tags")
    .upsert(rows, { onConflict: "user_id,movie_id,tag_id" });

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
    movie_id: movieId,
    tag_id: validatedTagId,
  }));

  const { error } = await supabase
    .from("user_movie_tags")
    .upsert(rows, { onConflict: "user_id,movie_id,tag_id" });

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
    .from("user_movie_tags")
    .delete()
    .eq("user_id", user.id)
    .eq("tag_id", validatedTagId)
    .in("movie_id", validatedIds);

  if (error) {
    throwDatabaseError("Failed to detach tag from movies.", error);
  }

  for (const movieId of validatedIds) {
    await queueTraktSyncEvent("movie.tag.remove", { movieId, tagId: validatedTagId });
  }
}
