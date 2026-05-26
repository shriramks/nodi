import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import type {
  Movie,
  MovieCastMember,
  MovieDetail,
  MovieStatus,
  MediaTypeFilter,
  LibraryMovie,
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

type LibraryMoviePageRow = UserMovie & {
  movie: Pick<Movie, "id" | "poster_path" | "title">;
  total_count: number;
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
  filters?: {
    genre?: string;
    language?: string;
    tagNames?: string[];
    rating?: {
      op: ">=" | ">" | "=" | "<" | "<=";
      value: number;
    };
    watchedYear?: string;
    watchedMonth?: string;
  };
};

export type LibraryMovieSortKey = "watched_date" | "added_date" | "rating" | "title";
export type LibraryMovieSortDirection = "asc" | "desc";

export type LibraryMoviePageOptions = {
  status: MovieStatus;
  type?: MediaTypeFilter;
  limit?: number;
  offset?: number;
  sort?: {
    key: LibraryMovieSortKey;
    direction: LibraryMovieSortDirection;
  };
  filters?: UserMovieListOptions["filters"];
};

export type LibraryMoviePage = {
  movies: LibraryMovie[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number | null;
};

export async function listUserMovies(options: UserMovieListOptions = {}) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const limit = Math.min(Math.max(options.limit ?? 1000, 1), 1000);
  const offset = Math.max(options.offset ?? 0, 0);
  const movieIdFilter = await buildMovieIdFilter(user.id, options.filters);

  if (movieIdFilter && movieIdFilter.size === 0) {
    return [];
  }

  let query = supabase
    .from("user_movies")
    .select("*, movies!inner(*)")
    .eq("user_id", user.id)
    .range(offset, offset + limit - 1);

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.filters?.genre) {
    query = query.ilike("movies.primary_genre_name", options.filters.genre);
  }

  if (options.filters?.language) {
    query = query.eq("movies.original_language", options.filters.language.toLowerCase());
  }

  if (options.filters?.rating) {
    const { op, value } = options.filters.rating;
    if (op === ">=") query = query.gte("personal_rating", value);
    if (op === ">") query = query.gt("personal_rating", value);
    if (op === "=") query = query.eq("personal_rating", value);
    if (op === "<") query = query.lt("personal_rating", value);
    if (op === "<=") query = query.lte("personal_rating", value);
  }

  if (movieIdFilter) {
    query = query.in("movie_id", [...movieIdFilter]);
  }

  const orderColumn = options.status === "to_watch" ? "watchlisted_at" : "last_watched_at";
  const { data, error } = await query.order(orderColumn, { ascending: false, nullsFirst: false });

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

export async function listLibraryMoviesPage(
  options: LibraryMoviePageOptions,
): Promise<LibraryMoviePage> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const limit = Math.min(Math.max(options.limit ?? 48, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const sort = normalizeLibrarySort(options.status, options.sort);
  const watchedRange = watchedFilterRange(options.filters);
  const { data, error } = await supabase.rpc("list_library_movies_page", {
    p_status: options.status,
    p_limit: limit,
    p_offset: offset,
    p_sort_key: sort.key,
    p_sort_direction: sort.direction,
    p_genre: options.filters?.genre ?? null,
    p_language: options.filters?.language?.toLowerCase() ?? null,
    p_tag_names: normalizeTagNames(options.filters?.tagNames),
    p_rating_op: options.filters?.rating?.op ?? null,
    p_rating_value: options.filters?.rating?.value ?? null,
    p_watched_start: watchedRange?.start ?? null,
    p_watched_end: watchedRange?.end ?? null,
  });

  if (error) {
    throwDatabaseError("Failed to load library movies.", error);
  }

  const rows = (data ?? []) as unknown as LibraryMoviePageRow[];
  const movies = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    movie_id: row.movie_id,
    status: row.status,
    personal_rating: row.personal_rating,
    added_at: row.added_at,
    watchlisted_at: row.watchlisted_at,
    last_watched_at: row.last_watched_at,
    updated_at: row.updated_at,
    movie: row.movie,
  } satisfies LibraryMovie));
  const totalCount = rows[0]?.total_count ?? 0;
  const nextOffset = offset + movies.length;
  const hasMore = nextOffset < totalCount;

  return {
    movies,
    totalCount,
    hasMore,
    nextOffset: hasMore ? nextOffset : null,
  };
}

function watchedFilterRange(filters: UserMovieListOptions["filters"]) {
  if (filters?.watchedMonth) {
    return monthRange(filters.watchedMonth);
  }

  if (filters?.watchedYear) {
    return yearRange(filters.watchedYear);
  }

  return null;
}

async function buildMovieIdFilter(
  userId: string,
  filters: UserMovieListOptions["filters"],
): Promise<Set<string> | null> {
  const filterSets: Array<Set<string>> = [];

  if (filters?.watchedMonth) {
    const range = monthRange(filters.watchedMonth);
    if (range) {
      filterSets.push(await listMovieIdsWatchedBetween(userId, range.start, range.end));
    }
  } else if (filters?.watchedYear) {
    const range = yearRange(filters.watchedYear);
    if (range) {
      filterSets.push(await listMovieIdsWatchedBetween(userId, range.start, range.end));
    }
  }

  const tagNames = normalizeTagNames(filters?.tagNames);
  if (tagNames.length > 0) {
    filterSets.push(await listMovieIdsWithTags(userId, tagNames));
  }

  if (filterSets.length === 0) {
    return null;
  }

  return filterSets.reduce((acc, set) => intersectSets(acc, set));
}

async function listMovieIdsWatchedBetween(userId: string, start: string, end: string) {
  const supabase = await createSupabaseServerClient();
  const rows: Array<{ movie_id: string }> = [];

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("watch_logs")
      .select("movie_id")
      .eq("user_id", userId)
      .gte("watched_at", start)
      .lt("watched_at", end)
      .range(offset, offset + 999);

    if (error) {
      throwDatabaseError("Failed to load watched-date filter rows.", error);
    }

    const page = (data ?? []) as Array<{ movie_id: string }>;
    rows.push(...page);

    if (page.length < 1000) {
      return new Set(rows.map((row) => row.movie_id));
    }
  }
}

async function listMovieIdsWithTags(userId: string, tagNames: string[]) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_movie_tags")
    .select("movie_id, tags!inner(name)")
    .eq("user_id", userId)
    .in("tags.normalized_name", tagNames.map(normalizeTagName));

  if (error) {
    throwDatabaseError("Failed to load tag filter rows.", error);
  }

  return new Set(((data ?? []) as Array<{ movie_id: string }>).map((row) => row.movie_id));
}

function intersectSets(a: Set<string>, b: Set<string>) {
  const next = new Set<string>();
  for (const value of a) {
    if (b.has(value)) {
      next.add(value);
    }
  }
  return next;
}

function normalizeTagNames(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeLibrarySort(
  status: MovieStatus,
  sort: LibraryMoviePageOptions["sort"],
) {
  if (sort) {
    return sort;
  }

  return status === "to_watch"
    ? { key: "added_date" as const, direction: "desc" as const }
    : { key: "watched_date" as const, direction: "desc" as const };
}

function yearRange(value: string) {
  if (!/^\d{4}$/.test(value)) {
    return null;
  }

  const year = Number(value);
  return {
    start: new Date(Date.UTC(year, 0, 1)).toISOString(),
    end: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
  };
}

function monthRange(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }

  return {
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    end: new Date(Date.UTC(year, month, 1)).toISOString(),
  };
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
