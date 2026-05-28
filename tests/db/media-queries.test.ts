import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import {
  getMediaDetail,
  getMediaStatsInput,
  getMediaWatchedMovieLibrarySummary,
  listMediaLibraryPage,
  listMediaLibraryMoviesPage,
  listMediaWatchedLibrarySummaryRows,
  listMediaWishlistPage,
  listTagsForMedia,
} from "@/lib/db/queries/media";

const userId = "10000000-0000-4000-8000-000000000000";
const mediaId = "30000000-0000-4000-8000-000000000000";

function createQuery(result: unknown) {
  return {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    result,
  };
}

function chainQuery(query: ReturnType<typeof createQuery>) {
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockResolvedValue(query.result);
  query.maybeSingle.mockResolvedValue(query.result);
  query.then.mockImplementation((resolve, reject) =>
    Promise.resolve(query.result).then(resolve, reject),
  );
  return query;
}

describe("media queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: userId });
  });

  it("loads the watched media library from media tables without routing through movies", async () => {
    const userMediaQuery = chainQuery(createQuery({
      data: [
        {
          added_at: "2026-05-01T00:00:00.000Z",
          completed_at: "2026-05-02T00:00:00.000Z",
          completion_mode: "manual",
          id: "20000000-0000-4000-8000-000000000000",
          last_watched_at: "2026-05-02T00:00:00.000Z",
          media: {
            id: mediaId,
            poster_path: "/poster.jpg",
            title: "Nodi",
            type: "movie",
          },
          media_id: mediaId,
          personal_rating: 8,
          status: "watched",
          updated_at: "2026-05-02T00:00:00.000Z",
          user_id: userId,
          watchlisted_at: null,
        },
      ],
      error: null,
      count: 2,
    }));
    const from = vi.fn((table: string) => {
      if (table !== "user_media") {
        throw new Error(`Unexpected table query: ${table}`);
      }

      return userMediaQuery;
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    await expect(listMediaLibraryPage({ type: "movie" })).resolves.toEqual({
      items: [
        expect.objectContaining({
          media: expect.objectContaining({ title: "Nodi", type: "movie" }),
        }),
      ],
      totalCount: 2,
      hasMore: true,
      nextOffset: 1,
    });

    expect(from).toHaveBeenCalledWith("user_media");
    expect(userMediaQuery.select).toHaveBeenCalledWith(
      "*, media:media_items!inner(id, type, poster_path, title)",
      { count: "exact" },
    );
    expect(userMediaQuery.eq).toHaveBeenCalledWith("status", "watched");
    expect(userMediaQuery.eq).toHaveBeenCalledWith("media_items.type", "movie");
  });

  it("loads wishlist rows with the media wishlist status", async () => {
    const userMediaQuery = chainQuery(createQuery({
      data: [
        {
          added_at: "2026-05-01T00:00:00.000Z",
          completed_at: null,
          completion_mode: null,
          id: "20000000-0000-4000-8000-000000000000",
          last_watched_at: null,
          media: { id: mediaId, poster_path: null, title: "Queued", type: "movie" },
          media_id: mediaId,
          personal_rating: null,
          status: "wishlist",
          updated_at: "2026-05-02T00:00:00.000Z",
          user_id: userId,
          watchlisted_at: "2026-05-01T00:00:00.000Z",
        },
      ],
      error: null,
      count: 1,
    }));
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => userMediaQuery),
    });

    await expect(listMediaWishlistPage()).resolves.toMatchObject({
      items: [{ status: "wishlist", media: { title: "Queued" } }],
      totalCount: 1,
      hasMore: false,
      nextOffset: null,
    });

    expect(userMediaQuery.eq).toHaveBeenCalledWith("status", "wishlist");
    expect(userMediaQuery.order).toHaveBeenCalledWith(
      "watchlisted_at",
      { ascending: false, nullsFirst: false },
    );
  });

  it("loads route-compatible movie library pages through the media RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          added_at: "2026-05-01T00:00:00.000Z",
          completed_at: "2026-05-02T00:00:00.000Z",
          completion_mode: "manual",
          id: "20000000-0000-4000-8000-000000000000",
          last_watched_at: "2026-05-02T00:00:00.000Z",
          movie: {
            id: mediaId,
            poster_path: "/poster.jpg",
            title: "Nodi",
            type: "movie",
          },
          movie_id: mediaId,
          personal_rating: 8,
          status: "watched",
          total_count: 2,
          updated_at: "2026-05-02T00:00:00.000Z",
          user_id: userId,
          watchlisted_at: null,
        },
      ],
      error: null,
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc });

    await expect(
      listMediaLibraryMoviesPage({
        status: "watched",
        type: "show",
        filters: {
          tagNames: [" Noir ", "noir"],
          watchedMonth: "2026-05",
          watchedYear: "2025",
        },
      }),
    ).resolves.toEqual({
      movies: [
        expect.objectContaining({
          movie: expect.objectContaining({ title: "Nodi" }),
        }),
      ],
      totalCount: 2,
      hasMore: true,
      nextOffset: 1,
    });

    expect(rpc).toHaveBeenCalledWith("list_media_library_movies_page", {
      p_status: "watched",
      p_type: "show",
      p_limit: 48,
      p_offset: 0,
      p_sort_key: "watched_date",
      p_sort_direction: "desc",
      p_genre: null,
      p_language: null,
      p_tag_names: ["Noir", "noir"],
      p_rating_op: null,
      p_rating_value: null,
      p_watched_start: "2026-05-01T00:00:00.000Z",
      p_watched_end: "2026-06-01T00:00:00.000Z",
    });
  });

  it("loads media detail state, activity, tags, and provider mappings", async () => {
    const queries = {
      mediaItems: chainQuery(createQuery({
        data: {
          id: mediaId,
          type: "movie",
          title: "Nodi",
          original_title: null,
          release_date: "2026-05-01",
          first_air_date: null,
          release_year: 2026,
          primary_genre_id: null,
          primary_genre_name: null,
          original_language: "en",
          overview: null,
          poster_path: null,
          backdrop_path: null,
          runtime_minutes: 100,
          tmdb_vote_average: null,
          tmdb_vote_count: null,
          popularity: null,
          studio: null,
          network: null,
          season_count: null,
          episode_count: null,
          metadata_updated_at: "2026-05-01T00:00:00.000Z",
          tmdb_enriched_at: null,
          created_at: "2026-05-01T00:00:00.000Z",
        },
        error: null,
      })),
      userMedia: chainQuery(createQuery({
        data: { id: "user-media-id", user_id: userId, media_id: mediaId, status: "watched" },
        error: null,
      })),
      activity: chainQuery(createQuery({
        data: [{ id: "activity-id", media_id: mediaId, watched_at: "2026-05-02T00:00:00.000Z" }],
        error: null,
      })),
      tags: chainQuery(createQuery({
        data: [{ tags: { id: "tag-id", name: "Noir", normalized_name: "noir", user_id: userId } }],
        error: null,
      })),
      mappings: chainQuery(createQuery({
        data: [{ media_id: mediaId, provider: "tmdb", provider_media_type: "movie", provider_id: "42" }],
        error: null,
      })),
    };
    const from = vi.fn((table: string) => {
      if (table === "media_items") return queries.mediaItems;
      if (table === "user_media") return queries.userMedia;
      if (table === "media_watch_activity") return queries.activity;
      if (table === "user_media_tags") return queries.tags;
      if (table === "media_provider_mappings") return queries.mappings;
      throw new Error(`Unexpected table query: ${table}`);
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    await expect(getMediaDetail(mediaId)).resolves.toMatchObject({
      id: mediaId,
      title: "Nodi",
      userMedia: { status: "watched" },
      watchActivity: [{ id: "activity-id" }],
      tags: [{ name: "Noir" }],
      providerMappings: [{ provider: "tmdb", provider_id: "42" }],
    });

    expect(from).toHaveBeenCalledWith("media_items");
    expect(from).toHaveBeenCalledWith("media_watch_activity");
    expect(from).toHaveBeenCalledWith("media_provider_mappings");
  });

  it("loads tags assigned to a media item through user_media_tags", async () => {
    const tagQuery = chainQuery(createQuery({
      data: [
        { tags: { id: "tag-1", name: "Noir" } },
        { tags: null },
      ],
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table !== "user_media_tags") {
        throw new Error(`Unexpected table query: ${table}`);
      }

      return tagQuery;
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    await expect(listTagsForMedia(mediaId)).resolves.toEqual([{ id: "tag-1", name: "Noir" }]);
    expect(tagQuery.eq).toHaveBeenCalledWith("media_id", mediaId);
  });

  it("loads media stats input rows from generalized media tables", async () => {
    const activityQuery = chainQuery(createQuery({
      data: [
        {
          id: "activity-id",
          media_id: mediaId,
          watched_at: "2026-05-02T00:00:00.000Z",
          media_items: { id: mediaId, type: "movie", runtime_minutes: 100 },
        },
      ],
      error: null,
    }));
    const tagQuery = chainQuery(createQuery({
      data: [{ media_id: mediaId, tags: { id: "tag-id", name: "Noir" } }],
      error: null,
    }));
    const ratingQuery = chainQuery(createQuery({
      data: [{ media_id: mediaId, personal_rating: 8 }],
      error: null,
    }));
    const stateQuery = chainQuery(createQuery({
      data: [{
        media_id: mediaId,
        status: "watched",
        personal_rating: 8,
        last_watched_at: "2026-05-02T00:00:00.000Z",
        completed_at: "2026-05-02T00:00:00.000Z",
        media_items: { id: mediaId, type: "movie", runtime_minutes: 100 },
      }],
      error: null,
    }));
    const userMediaQueries = [ratingQuery, stateQuery];
    const from = vi.fn((table: string) => {
      if (table === "media_watch_activity") return activityQuery;
      if (table === "user_media_tags") return tagQuery;
      if (table === "user_media") return userMediaQueries.shift() ?? stateQuery;
      throw new Error(`Unexpected table query: ${table}`);
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    await expect(getMediaStatsInput("movie")).resolves.toEqual({
      watchRows: [expect.objectContaining({ media_id: mediaId })],
      tagRows: [expect.objectContaining({ media_id: mediaId })],
      ratingRows: [{ media_id: mediaId, personal_rating: 8 }],
      stateRows: [expect.objectContaining({ media_id: mediaId })],
    });

    expect(from).toHaveBeenCalledWith("media_watch_activity");
    expect(from).toHaveBeenCalledWith("user_media_tags");
    expect(from).toHaveBeenCalledWith("user_media");
    expect(activityQuery.eq).toHaveBeenCalledWith("media_items.type", "movie");
    expect(tagQuery.eq).toHaveBeenCalledWith("media_items.type", "movie");
    expect(ratingQuery.eq).toHaveBeenCalledWith("media_items.type", "movie");
    expect(stateQuery.eq).toHaveBeenCalledWith("media_items.type", "movie");
  });

  it("loads lightweight watched summary rows from media watch activity", async () => {
    const activityQuery = chainQuery(createQuery({
      data: [
        {
          media_id: mediaId,
          watched_at: "2026-05-02T00:00:00.000Z",
          media_items: { id: mediaId, type: "movie", original_language: "en" },
        },
      ],
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table !== "media_watch_activity") {
        throw new Error(`Unexpected table query: ${table}`);
      }

      return activityQuery;
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    await expect(listMediaWatchedLibrarySummaryRows("movie")).resolves.toEqual([
      expect.objectContaining({ media_id: mediaId }),
    ]);

    expect(activityQuery.select).toHaveBeenCalledWith(
      "media_id, watched_at, media_items!inner(id, type, original_language, primary_genre_name)",
    );
  });

  it("builds the route movie summary from media watch activity rows", async () => {
    const activityQuery = chainQuery(createQuery({
      data: [
        {
          media_id: mediaId,
          watched_at: "2026-05-02T00:00:00.000Z",
          media_items: {
            id: mediaId,
            type: "movie",
            original_language: "en",
            primary_genre_name: "Drama",
          },
        },
        {
          media_id: mediaId,
          watched_at: "2026-05-03T00:00:00.000Z",
          media_items: {
            id: mediaId,
            type: "movie",
            original_language: "en",
            primary_genre_name: "Drama",
          },
        },
      ],
      error: null,
    }));
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== "media_watch_activity") {
          throw new Error(`Unexpected table query: ${table}`);
        }

        return activityQuery;
      }),
    });

    await expect(getMediaWatchedMovieLibrarySummary()).resolves.toMatchObject({
      watchedCount: 1,
      genreBreakdown: [{ key: "drama", label: "Drama", count: 1 }],
      languageBreakdown: [{ key: "en", label: "English", count: 1 }],
    });
  });
});
