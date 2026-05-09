import type { UserMovieInsert } from "@/lib/db/types";
import type { WatchActionPayload } from "@/lib/db/validation";

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
