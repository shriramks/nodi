import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSyncEvent: vi.fn(),
  requireUser: vi.fn(),
  upsertTag: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/db/mutations/sync", () => ({
  createSyncEvent: mocks.createSyncEvent,
}));

vi.mock("@/lib/db/mutations/tags", () => ({
  upsertTag: mocks.upsertTag,
}));

import {
  addMediaMovieWatchDate,
  createAndAttachTagToMediaMovie,
  detachTagFromMediaMovie,
  removeUserMediaMovie,
  setMediaMovieWatchStatus,
  updateMediaMovieRating,
} from "@/lib/db/mutations/media";

const movieId = "00000000-0000-4000-8000-000000000000";
const userId = "10000000-0000-4000-8000-000000000000";
const userMediaId = "20000000-0000-4000-8000-000000000000";
const watchActivityId = "30000000-0000-4000-8000-000000000000";
const tagId = "40000000-0000-4000-8000-000000000000";
const watchedAt = "2026-05-02T12:00:00.000Z";

const watchedUserMedia = {
  added_at: "2026-05-01T00:00:00.000Z",
  completed_at: watchedAt,
  completion_mode: "manual" as const,
  id: userMediaId,
  last_watched_at: watchedAt,
  media_id: movieId,
  personal_rating: null,
  status: "watched" as const,
  updated_at: watchedAt,
  user_id: userId,
  watchlisted_at: null,
};

const watchActivity = {
  created_at: watchedAt,
  episode_id: null,
  id: watchActivityId,
  legacy_watch_log_id: null,
  media_id: movieId,
  notes: null,
  provider_event_id: null,
  source: "manual" as const,
  user_id: userId,
  watched_at: watchedAt,
};

function createQuery(result: unknown) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    then: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    result,
  };

  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.upsert.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  query.then.mockImplementation((resolve, reject) =>
    Promise.resolve(result).then(resolve, reject),
  );

  return query;
}

function createSupabaseWithQueues(queriesByTable: Record<string, ReturnType<typeof createQuery>[]>) {
  const from = vi.fn((table: string) => {
    const query = queriesByTable[table]?.shift();

    if (!query) {
      throw new Error(`Unexpected table query: ${table}`);
    }

    return query;
  });

  mocks.createSupabaseServerClient.mockResolvedValue({ from });

  return { from };
}

describe("media movie mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: userId });
    mocks.createSyncEvent.mockResolvedValue({ id: "sync-event-id" });
    mocks.upsertTag.mockResolvedValue({
      created_at: "2026-05-01T00:00:00.000Z",
      id: tagId,
      name: "Noir",
      normalized_name: "noir",
      user_id: userId,
    });
  });

  it("marks watched through media tables and queues the current movie push event", async () => {
    const userMediaUpsert = createQuery({ data: watchedUserMedia, error: null });
    const activityInsert = createQuery({ data: watchActivity, error: null });
    const latestActivity = createQuery({ data: { watched_at: watchedAt }, error: null });
    const userMediaRefresh = createQuery({ data: watchedUserMedia, error: null });
    const { from } = createSupabaseWithQueues({
      media_watch_activity: [activityInsert, latestActivity],
      user_media: [userMediaUpsert, userMediaRefresh],
    });

    await expect(
      setMediaMovieWatchStatus({
        movieId,
        source: "manual",
        status: "watched",
        watchedAt,
      }),
    ).resolves.toEqual({
      userMedia: watchedUserMedia,
      watchActivity,
    });

    expect(from).toHaveBeenCalledWith("user_media");
    expect(from).toHaveBeenCalledWith("media_watch_activity");
    expect(userMediaUpsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        completed_at: watchedAt,
        completion_mode: "manual",
        last_watched_at: watchedAt,
        media_id: movieId,
        status: "watched",
        user_id: userId,
        watchlisted_at: null,
      }),
      { onConflict: "user_id,media_id" },
    );
    expect(activityInsert.insert).toHaveBeenCalledWith({
      media_id: movieId,
      notes: null,
      provider_event_id: null,
      source: "manual",
      user_id: userId,
      watched_at: watchedAt,
    });
    expect(mocks.createSyncEvent).toHaveBeenCalledWith({
      direction: "push",
      eventType: "movie.mark_watched",
      payload: {
        movieId,
        personalRating: null,
        userMovieId: userMediaId,
        watchLogId: watchActivityId,
        watchedAt,
      },
      provider: "trakt",
      status: "pending",
    });
  });

  it("moves a movie to the media wishlist without writing watch activity", async () => {
    const wishlistUserMedia = {
      ...watchedUserMedia,
      completed_at: null,
      completion_mode: null,
      last_watched_at: null,
      status: "wishlist" as const,
      watchlisted_at: "2026-05-03T12:00:00.000Z",
    };
    const userMediaUpsert = createQuery({ data: wishlistUserMedia, error: null });
    createSupabaseWithQueues({
      user_media: [userMediaUpsert],
    });

    await expect(
      setMediaMovieWatchStatus({
        movieId,
        personalRating: null,
        status: "to_watch",
      }),
    ).resolves.toEqual({
      userMedia: wishlistUserMedia,
      watchActivity: null,
    });

    expect(userMediaUpsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        completed_at: null,
        completion_mode: null,
        last_watched_at: null,
        media_id: movieId,
        personal_rating: null,
        status: "wishlist",
        user_id: userId,
        watchlisted_at: expect.any(String),
      }),
      { onConflict: "user_id,media_id" },
    );
    expect(mocks.createSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "movie.add_to_watchlist",
      }),
    );
  });

  it("adds a repeat watch date and skips outbound sync for inbound Trakt writes", async () => {
    const userMediaUpsert = createQuery({ data: watchedUserMedia, error: null });
    const activityInsert = createQuery({
      data: {
        ...watchActivity,
        provider_event_id: "trakt-history-1",
        source: "trakt_sync",
      },
      error: null,
    });
    const latestActivity = createQuery({ data: { watched_at: watchedAt }, error: null });
    const userMediaRefresh = createQuery({ data: watchedUserMedia, error: null });
    createSupabaseWithQueues({
      media_watch_activity: [activityInsert, latestActivity],
      user_media: [userMediaUpsert, userMediaRefresh],
    });

    await expect(
      addMediaMovieWatchDate(movieId, {
        providerEventId: "trakt-history-1",
        source: "trakt_sync",
        watchedAt,
      }),
    ).resolves.toMatchObject({
      watchActivity: {
        provider_event_id: "trakt-history-1",
        source: "trakt_sync",
      },
    });

    expect(mocks.createSyncEvent).not.toHaveBeenCalled();
  });

  it("updates ratings through user_media and keeps the legacy movie sync payload", async () => {
    const ratingUpdate = createQuery({
      data: {
        ...watchedUserMedia,
        personal_rating: 8,
      },
      error: null,
    });
    createSupabaseWithQueues({
      user_media: [ratingUpdate],
    });

    await expect(updateMediaMovieRating(movieId, { personalRating: 8 })).resolves.toMatchObject({
      personal_rating: 8,
    });

    expect(ratingUpdate.update).toHaveBeenCalledWith({ personal_rating: 8 });
    expect(ratingUpdate.eq).toHaveBeenCalledWith("media_id", movieId);
    expect(mocks.createSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "movie.rating.set",
        payload: {
          movieId,
          personalRating: 8,
          userMovieId: userMediaId,
        },
      }),
    );
  });

  it("creates, attaches, and detaches tags through user_media_tags", async () => {
    const attach = createQuery({
      data: {
        created_at: "2026-05-01T00:00:00.000Z",
        media_id: movieId,
        tag_id: tagId,
        user_id: userId,
      },
      error: null,
    });
    const detach = createQuery({ data: null, error: null });
    createSupabaseWithQueues({
      user_media_tags: [attach, detach],
    });

    await expect(createAndAttachTagToMediaMovie(movieId, { name: "Noir" })).resolves.toMatchObject({
      tag: { id: tagId, name: "Noir" },
      userMediaTag: { media_id: movieId, tag_id: tagId },
    });
    await expect(detachTagFromMediaMovie(movieId, tagId)).resolves.toBeUndefined();

    expect(mocks.upsertTag).toHaveBeenCalledWith({ name: "Noir" });
    expect(attach.upsert).toHaveBeenCalledWith(
      {
        media_id: movieId,
        tag_id: tagId,
        user_id: userId,
      },
      { onConflict: "user_id,media_id,tag_id" },
    );
    expect(detach.delete).toHaveBeenCalled();
    expect(detach.eq).toHaveBeenCalledWith("media_id", movieId);
    expect(mocks.createSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "movie.tag.add",
      }),
    );
    expect(mocks.createSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "movie.tag.remove",
      }),
    );
  });

  it("removes user_media rows and queues the matching movie removal event", async () => {
    const loadExisting = createQuery({ data: watchedUserMedia, error: null });
    const deleteExisting = createQuery({ data: null, error: null });
    createSupabaseWithQueues({
      user_media: [loadExisting, deleteExisting],
    });

    await expect(removeUserMediaMovie(movieId)).resolves.toBeUndefined();

    expect(loadExisting.select).toHaveBeenCalledWith("*");
    expect(deleteExisting.delete).toHaveBeenCalled();
    expect(deleteExisting.eq).toHaveBeenCalledWith("media_id", movieId);
    expect(mocks.createSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "movie.remove_from_library",
        payload: {
          movieId,
          userMovieId: userMediaId,
        },
      }),
    );
  });
});
