import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError, throwNotFound } from "@/lib/db/errors";
import type {
  MediaItem,
  MediaProviderMapping,
  MediaStatus,
  MediaType,
  MediaWatchActivity,
  Tag,
  UserMedia,
  UserMediaTag,
} from "@/lib/db/types";
import { validateUuid } from "@/lib/db/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const mediaPageSize = 1000;
export type MediaTypeFilter = MediaType | "all";

type MediaJoinRow = UserMedia & {
  media: Pick<MediaItem, "id" | "type" | "poster_path" | "title"> | null;
};

type MediaTagJoinRow = {
  tags: Tag | null;
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
