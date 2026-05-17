import type { UserMovieInsert } from "@/lib/db/types";
import type { WatchActionPayload } from "@/lib/db/validation";

export type MovieWatchStateOperation = "set_status" | "add_watch_date";

export type MovieWatchStateMutationArgs = {
  p_has_personal_rating: boolean;
  p_movie_id: string;
  p_notes: string | null;
  p_operation: MovieWatchStateOperation;
  p_personal_rating: number | null;
  p_provider_event_id: string | null;
  p_source: WatchActionPayload["source"] | null;
  p_status: WatchActionPayload["status"];
  p_watched_at: string | null;
};

export function shouldQueueOutboundSync(source: string | null | undefined) {
  return source !== "trakt_sync";
}

export function latestTimestamp(left: string | null | undefined, right: string) {
  if (!left) {
    return right;
  }

  return Date.parse(left) > Date.parse(right) ? left : right;
}

export function buildUserMovieStatusPayload({
  action,
  now,
  userId,
}: {
  action: WatchActionPayload;
  now: string;
  userId: string;
}): UserMovieInsert {
  const userMoviePayload: UserMovieInsert = {
    user_id: userId,
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

  return userMoviePayload;
}

export function buildMovieWatchStateMutationArgs({
  action,
  operation,
}: {
  action: WatchActionPayload;
  operation: MovieWatchStateOperation;
}): MovieWatchStateMutationArgs {
  const hasPersonalRating = Object.hasOwn(action, "personalRating");

  return {
    p_has_personal_rating: hasPersonalRating,
    p_movie_id: action.movieId,
    p_notes: action.notes ?? null,
    p_operation: operation,
    p_personal_rating: hasPersonalRating ? (action.personalRating ?? null) : null,
    p_provider_event_id: action.providerEventId ?? null,
    p_source: action.source ?? null,
    p_status: action.status,
    p_watched_at: action.watchedAt ?? null,
  };
}
