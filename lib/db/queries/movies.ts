import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import type {
  Movie,
  MovieCastMember,
  MovieDetail,
  MovieStatus,
  Tag,
  UserMovie,
  UserMovieWithMovie,
  WatchLog,
} from "@/lib/db/types";
import { validateUuid } from "@/lib/db/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type UserMovieJoinRow = UserMovie & {
  movies: Movie | null;
};

type WatchLogJoinRow = WatchLog & {
  movies: Pick<Movie, "id" | "title" | "release_year" | "runtime_minutes" | "original_language"> | null;
};

type TagJoinRow = {
  tags: Tag | null;
};

export type UserMovieListOptions = {
  status?: MovieStatus;
  limit?: number;
  offset?: number;
};

export async function listUserMovies(options: UserMovieListOptions = {}) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const limit = Math.min(Math.max(options.limit ?? 60, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = supabase
    .from("user_movies")
    .select("*, movies(*)")
    .eq("user_id", user.id)
    .range(offset, offset + limit - 1);

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const orderColumn = options.status === "to_watch" ? "watchlisted_at" : "last_watched_at";
  const { data, error } = await query.order(orderColumn, {
    ascending: false,
    nullsFirst: false,
  });

  if (error) {
    throwDatabaseError("Failed to load user movies.", error);
  }

  return ((data ?? []) as unknown as UserMovieJoinRow[]).flatMap((row) => {
    if (!row.movies) {
      return [];
    }

    const { movies, ...userMovie } = row;
    return [{ ...userMovie, movie: movies } satisfies UserMovieWithMovie];
  });
}

export async function getMovieDetail(movieId: string): Promise<MovieDetail> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(movieId, "movieId");

  const [{ data: movie, error: movieError }, { data: cast, error: castError }] =
    await Promise.all([
      supabase.from("movies").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("movie_cast")
        .select("*")
        .eq("movie_id", id)
        .order("cast_order", { ascending: true, nullsFirst: false })
        .limit(12),
    ]);

  if (movieError) {
    throwDatabaseError("Failed to load movie.", movieError);
  }

  if (castError) {
    throwDatabaseError("Failed to load movie cast.", castError);
  }

  if (!movie) {
    throwNotFound("Movie was not found.");
  }

  const [
    { data: userMovie, error: userMovieError },
    { data: watchLogs, error: watchLogsError },
    { data: tagRows, error: tagsError },
  ] = await Promise.all([
    supabase
      .from("user_movies")
      .select("*")
      .eq("user_id", user.id)
      .eq("movie_id", id)
      .maybeSingle(),
    supabase
      .from("watch_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("movie_id", id)
      .order("watched_at", { ascending: false }),
    supabase
      .from("user_movie_tags")
      .select("tags(*)")
      .eq("user_id", user.id)
      .eq("movie_id", id),
  ]);

  if (userMovieError) {
    throwDatabaseError("Failed to load user movie state.", userMovieError);
  }

  if (watchLogsError) {
    throwDatabaseError("Failed to load watch logs.", watchLogsError);
  }

  if (tagsError) {
    throwDatabaseError("Failed to load tags.", tagsError);
  }

  return {
    ...(movie as Movie),
    cast: (cast ?? []) as MovieCastMember[],
    userMovie: (userMovie as UserMovie | null) ?? null,
    watchLogs: (watchLogs ?? []) as WatchLog[],
    tags: ((tagRows ?? []) as unknown as TagJoinRow[]).flatMap((row) =>
      row.tags ? [row.tags] : [],
    ),
  };
}

export async function listRecentWatchLogs(limit = 20) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const cappedLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("watch_logs")
    .select("*, movies(id, title, release_year, runtime_minutes, original_language)")
    .eq("user_id", user.id)
    .order("watched_at", { ascending: false })
    .limit(cappedLimit);

  if (error) {
    throwDatabaseError("Failed to load watch logs.", error);
  }

  return (data ?? []) as unknown as WatchLogJoinRow[];
}
