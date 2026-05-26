import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import type {
  LibraryMovie,
  Episode,
  MediaItem,
  MediaProviderMapping,
  MediaStatus,
  MediaTypeFilter,
  MovieStatus,
  MediaWatchActivity,
  Tag,
  UserMedia,
  UserMediaTag,
  WatchedLibrarySummary,
} from "@/lib/db/types";
import { validateUuid } from "@/lib/db/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LibraryMoviePage, LibraryMoviePageOptions } from "./movies";
import {
  buildWatchedLibrarySummary,
  type WatchedLibrarySummaryRow,
} from "./stats-transforms";

const mediaPageSize = 1000;

type MediaJoinRow = UserMedia & {
  media: Pick<MediaItem, "id" | "type" | "poster_path" | "title"> | null;
};

type MediaTagJoinRow = {
  tags: Tag | null;
};

type MediaLibraryMoviePageRow = Omit<UserMedia, "status"> & {
  movie_id: string;
  status: MovieStatus;
  movie: Pick<MediaItem, "id" | "type" | "poster_path" | "title">;
  total_count: number;
};

export type MediaLibraryItem = UserMedia & {
  media: Pick<MediaItem, "id" | "type" | "poster_path" | "title">;
};

export type MediaLibraryPageOptions = {
  limit?: number;
  offset?: number;
  type?: MediaTypeFilter;
};

export type MediaLibraryPage = {
  items: MediaLibraryItem[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number | null;
};

export type MediaDetail = MediaItem & {
  userMedia: UserMedia | null;
  watchActivity: MediaWatchActivity[];
  tags: Tag[];
  providerMappings: MediaProviderMapping[];
};

export type ShowSeason = {
  seasonNumber: number;
  episodes: Episode[];
};

export type ShowDetail = MediaDetail & {
  seasons: ShowSeason[];
};

export type MediaWatchActivityAnalyticsRow = Pick<
  MediaWatchActivity,
  "id" | "media_id" | "watched_at"
> & {
  media_items: Pick<
    MediaItem,
    "id" | "type" | "runtime_minutes" | "original_language" | "primary_genre_name" | "release_year"
  > | null;
};

export type MediaWatchedLibrarySummaryRow = Pick<
  MediaWatchActivity,
  "media_id" | "watched_at"
> & {
  media_items: Pick<
    MediaItem,
    "id" | "type" | "original_language" | "primary_genre_name"
  > | null;
};

export type MediaTagAnalyticsRow = Pick<UserMediaTag, "media_id"> & {
  tags: Pick<Tag, "id" | "name"> | null;
};

export type MediaRatingAnalyticsRow = {
  media_id: string;
  personal_rating: number | null;
};

export type MediaStatsInput = {
  watchRows: MediaWatchActivityAnalyticsRow[];
  tagRows: MediaTagAnalyticsRow[];
  ratingRows: MediaRatingAnalyticsRow[];
};

export async function listMediaLibraryPage(
  options: MediaLibraryPageOptions = {},
): Promise<MediaLibraryPage> {
  return listMediaCollectionPage("watched", options, {
    orderColumn: "last_watched_at",
    errorMessage: "Failed to load media library.",
  });
}

export async function listMediaWishlistPage(
  options: MediaLibraryPageOptions = {},
): Promise<MediaLibraryPage> {
  return listMediaCollectionPage("wishlist", options, {
    orderColumn: "watchlisted_at",
    errorMessage: "Failed to load media wishlist.",
  });
}

export async function listMediaLibraryMoviesPage(
  options: LibraryMoviePageOptions,
): Promise<LibraryMoviePage> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const limit = Math.min(Math.max(options.limit ?? 48, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const sort = normalizeMediaMovieLibrarySort(options.status, options.sort);
  const watchedRange = watchedFilterRange(options.filters);
  const { data, error } = await supabase.rpc("list_media_library_movies_page", {
    p_status: options.status,
    p_type: options.type ?? "all",
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
    throwDatabaseError("Failed to load media-backed library movies.", error);
  }

  const rows = (data ?? []) as unknown as MediaLibraryMoviePageRow[];
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

export async function getMediaWatchedMovieLibrarySummary(
  type: MediaTypeFilter = "all",
): Promise<WatchedLibrarySummary> {
  const rows = await listMediaWatchedLibrarySummaryRows(type);

  return buildWatchedLibrarySummary(rows.map((row) => ({
    movie_id: row.media_id,
    watched_at: row.watched_at,
    movies: row.media_items,
  } satisfies WatchedLibrarySummaryRow)));
}

async function listMediaCollectionPage(
  status: Extract<MediaStatus, "watched" | "wishlist">,
  options: MediaLibraryPageOptions,
  config: { orderColumn: "last_watched_at" | "watchlisted_at"; errorMessage: string },
) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const limit = Math.min(Math.max(options.limit ?? 48, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = supabase
    .from("user_media")
    .select(
      "*, media:media_items!inner(id, type, poster_path, title)",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .eq("status", status);

  if (options.type && options.type !== "all") {
    query = query.eq("media_items.type", options.type);
  }

  const { data, error, count } = await query
    .order(config.orderColumn, { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throwDatabaseError(config.errorMessage, error);
  }

  const items = ((data ?? []) as unknown as MediaJoinRow[]).flatMap((row) => {
    if (!row.media) {
      return [];
    }

    const { media, ...userMedia } = row;
    return [{ ...userMedia, media } satisfies MediaLibraryItem];
  });
  const totalCount = count ?? items.length;
  const nextOffset = offset + items.length;
  const hasMore = nextOffset < totalCount;

  return {
    items,
    totalCount,
    hasMore,
    nextOffset: hasMore ? nextOffset : null,
  };
}

function watchedFilterRange(filters: LibraryMoviePageOptions["filters"]) {
  if (filters?.watchedMonth) {
    return monthRange(filters.watchedMonth);
  }

  if (filters?.watchedYear) {
    return yearRange(filters.watchedYear);
  }

  return null;
}

function normalizeMediaMovieLibrarySort(
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

function normalizeTagNames(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
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

export async function getMediaDetail(mediaId: string): Promise<MediaDetail> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(mediaId, "mediaId");

  const { data: media, error: mediaError } = await supabase
    .from("media_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (mediaError) {
    throwDatabaseError("Failed to load media item.", mediaError);
  }

  if (!media) {
    throwNotFound("Media item was not found.");
  }

  const [
    { data: userMedia, error: userMediaError },
    { data: watchActivity, error: watchActivityError },
    { data: tagRows, error: tagsError },
    { data: providerMappings, error: providerMappingsError },
  ] = await Promise.all([
    supabase
      .from("user_media")
      .select("*")
      .eq("user_id", user.id)
      .eq("media_id", id)
      .maybeSingle(),
    supabase
      .from("media_watch_activity")
      .select("*")
      .eq("user_id", user.id)
      .eq("media_id", id)
      .order("watched_at", { ascending: false }),
    supabase
      .from("user_media_tags")
      .select("tags(*)")
      .eq("user_id", user.id)
      .eq("media_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("media_provider_mappings")
      .select("*")
      .eq("media_id", id)
      .order("provider", { ascending: true }),
  ]);

  if (userMediaError) {
    throwDatabaseError("Failed to load user media state.", userMediaError);
  }

  if (watchActivityError) {
    throwDatabaseError("Failed to load media watch activity.", watchActivityError);
  }

  if (tagsError) {
    throwDatabaseError("Failed to load media tags.", tagsError);
  }

  if (providerMappingsError) {
    throwDatabaseError("Failed to load media provider mappings.", providerMappingsError);
  }

  return {
    ...(media as MediaItem),
    userMedia: (userMedia as UserMedia | null) ?? null,
    watchActivity: (watchActivity ?? []) as MediaWatchActivity[],
    tags: ((tagRows ?? []) as unknown as MediaTagJoinRow[]).flatMap((row) =>
      row.tags ? [row.tags] : [],
    ),
    providerMappings: (providerMappings ?? []) as MediaProviderMapping[],
  };
}

export async function getShowDetail(showId: string): Promise<ShowDetail> {
  const detail = await getMediaDetail(showId);

  if (detail.type !== "show") {
    throwNotFound("Show was not found.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("show_id", detail.id)
    .order("season_number", { ascending: true })
    .order("episode_number", { ascending: true });

  if (error) {
    throwDatabaseError("Failed to load show episodes.", error);
  }

  return {
    ...detail,
    seasons: groupEpisodesBySeason((data ?? []) as Episode[]),
  };
}

function groupEpisodesBySeason(episodes: Episode[]): ShowSeason[] {
  const seasonsByNumber = new Map<number, Episode[]>();

  episodes.forEach((episode) => {
    const season = seasonsByNumber.get(episode.season_number) ?? [];
    season.push(episode);
    seasonsByNumber.set(episode.season_number, season);
  });

  return Array.from(seasonsByNumber.entries()).map(([seasonNumber, seasonEpisodes]) => ({
    seasonNumber,
    episodes: seasonEpisodes,
  }));
}

export async function listTagsForMedia(mediaId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(mediaId, "mediaId");

  const { data, error } = await supabase
    .from("user_media_tags")
    .select("tags(*)")
    .eq("user_id", user.id)
    .eq("media_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    throwDatabaseError("Failed to load media tags.", error);
  }

  return ((data ?? []) as unknown as MediaTagJoinRow[]).flatMap((row) =>
    row.tags ? [row.tags] : [],
  );
}

export async function getMediaStatsInput(
  type: MediaTypeFilter = "all",
): Promise<MediaStatsInput> {
  const user = await requireUser();
  const [watchRows, tagRows, ratingRows] = await Promise.all([
    listMediaWatchActivityAnalyticsRowsForUser(user.id, type),
    listMediaTagAnalyticsRowsForUser(user.id, type),
    listMediaRatingAnalyticsRowsForUser(user.id, type),
  ]);

  return { watchRows, tagRows, ratingRows };
}

export async function listMediaWatchedLibrarySummaryRows(
  type: MediaTypeFilter = "all",
): Promise<MediaWatchedLibrarySummaryRow[]> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const rows: MediaWatchedLibrarySummaryRow[] = [];

  for (let offset = 0; ; offset += mediaPageSize) {
    let query = supabase
      .from("media_watch_activity")
      .select("media_id, watched_at, media_items!inner(id, type, original_language, primary_genre_name)")
      .eq("user_id", user.id);

    if (type !== "all") {
      query = query.eq("media_items.type", type);
    }

    const { data, error } = await query
      .order("watched_at", { ascending: true })
      .range(offset, offset + mediaPageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load media watched-library summary rows.", error);
    }

    const page = (data ?? []) as unknown as MediaWatchedLibrarySummaryRow[];
    rows.push(...page);

    if (page.length < mediaPageSize) {
      return rows;
    }
  }
}

async function listMediaWatchActivityAnalyticsRowsForUser(
  userId: string,
  type: MediaTypeFilter,
) {
  const supabase = await createSupabaseServerClient();
  const rows: MediaWatchActivityAnalyticsRow[] = [];

  for (let offset = 0; ; offset += mediaPageSize) {
    let query = supabase
      .from("media_watch_activity")
      .select(
        "id, media_id, watched_at, media_items!inner(id, type, runtime_minutes, original_language, primary_genre_name, release_year)",
      )
      .eq("user_id", userId);

    if (type !== "all") {
      query = query.eq("media_items.type", type);
    }

    const { data, error } = await query
      .order("watched_at", { ascending: true })
      .range(offset, offset + mediaPageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load media watch-activity analytics rows.", error);
    }

    const page = (data ?? []) as unknown as MediaWatchActivityAnalyticsRow[];
    rows.push(...page);

    if (page.length < mediaPageSize) {
      return rows;
    }
  }
}

async function listMediaTagAnalyticsRowsForUser(
  userId: string,
  type: MediaTypeFilter,
) {
  const supabase = await createSupabaseServerClient();
  const rows: MediaTagAnalyticsRow[] = [];

  for (let offset = 0; ; offset += mediaPageSize) {
    let query = supabase
      .from("user_media_tags")
      .select("media_id, tags(id, name), media_items!inner(id, type)")
      .eq("user_id", userId);

    if (type !== "all") {
      query = query.eq("media_items.type", type);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + mediaPageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load media tag analytics rows.", error);
    }

    const page = (data ?? []) as unknown as MediaTagAnalyticsRow[];
    rows.push(...page);

    if (page.length < mediaPageSize) {
      return rows;
    }
  }
}

async function listMediaRatingAnalyticsRowsForUser(
  userId: string,
  type: MediaTypeFilter,
): Promise<MediaRatingAnalyticsRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("user_media")
    .select("media_id, personal_rating, media_items!inner(id, type)")
    .eq("user_id", userId)
    .eq("status", "watched")
    .not("personal_rating", "is", null);

  if (type !== "all") {
    query = query.eq("media_items.type", type);
  }

  const { data, error } = await query.order("media_id", { ascending: true });

  if (error) {
    throwDatabaseError("Failed to load media rating analytics.", error);
  }

  return (data ?? []) as MediaRatingAnalyticsRow[];
}
