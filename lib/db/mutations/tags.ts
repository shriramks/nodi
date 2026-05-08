import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import type { Json, Tag } from "@/lib/db/types";
import { validateTagPayload, validateUuid } from "@/lib/db/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSyncEvent } from "./sync";

type TraktSyncPayload = Record<string, Json>;

function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
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

export async function upsertTag(payload: unknown): Promise<Tag> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const tag = validateTagPayload(payload);

  const { data, error } = await supabase
    .from("tags")
    .upsert(
      {
        user_id: user.id,
        name: tag.name,
        normalized_name: normalizeTagName(tag.name),
      },
      { onConflict: "user_id,normalized_name" },
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to upsert tag.", error);
  }

  return data;
}

export async function attachTagToMovie(movieId: string, tagId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedMovieId = validateUuid(movieId, "movieId");
  const validatedTagId = validateUuid(tagId, "tagId");

  const { data, error } = await supabase
    .from("user_movie_tags")
    .upsert(
      {
        user_id: user.id,
        movie_id: validatedMovieId,
        tag_id: validatedTagId,
      },
      { onConflict: "user_id,movie_id,tag_id" },
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to attach tag to movie.", error);
  }

  return data;
}

export async function createAndAttachTag(movieId: string, payload: unknown) {
  const tag = await upsertTag(payload);
  const userMovieTag = await attachTagToMovie(movieId, tag.id);

  await queueTraktSyncEvent("movie.tag.add", {
    movieId,
    tagId: tag.id,
    tagName: tag.name,
  });

  return {
    tag,
    userMovieTag,
  };
}

export async function detachTagFromMovie(movieId: string, tagId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const validatedMovieId = validateUuid(movieId, "movieId");
  const validatedTagId = validateUuid(tagId, "tagId");

  const { error } = await supabase
    .from("user_movie_tags")
    .delete()
    .eq("user_id", user.id)
    .eq("movie_id", validatedMovieId)
    .eq("tag_id", validatedTagId);

  if (error) {
    throwDatabaseError("Failed to detach tag from movie.", error);
  }

  await queueTraktSyncEvent("movie.tag.remove", {
    movieId: validatedMovieId,
    tagId: validatedTagId,
  });
}
