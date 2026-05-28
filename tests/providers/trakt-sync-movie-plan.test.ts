import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db/mutations", () => ({
  createSyncEvent: vi.fn(),
  updateSyncEventStatus: vi.fn(),
  upsertSyncCursor: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  listPendingSyncEvents: vi.fn(),
}));

vi.mock("@/lib/providers/trakt/credentials", () => ({
  loadTraktSyncCredentials: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { __traktSyncTestHooks } from "@/lib/providers/trakt/sync";
import type {
  RemoteTraktMovieState,
  RemoteTraktRatingState,
  RemoteTraktWatchlistState,
} from "@/lib/providers/trakt/adapters";

type MovieWriteArgs = Parameters<typeof __traktSyncTestHooks.planPullUserMovieWrites>[0];
type UserMediaDraft = MovieWriteArgs["existingUserMovies"] extends Map<string, infer Draft>
  ? Draft
  : never;

function remoteMovie(
  overrides: Partial<RemoteTraktMovieState> & Pick<RemoteTraktMovieState, "key">,
): RemoteTraktMovieState {
  return {
    imdbId: null,
    title: null,
    tmdbId: null,
    traktId: null,
    year: null,
    ...overrides,
  };
}

function draft(overrides: Partial<UserMediaDraft> & Pick<UserMediaDraft, "mediaId">): UserMediaDraft {
  return {
    completedAt: null,
    completionMode: null,
    lastWatchedAt: null,
    personalRating: null,
    status: "wishlist",
    watchlistedAt: null,
    ...overrides,
  };
}

function movieResolution(
  entries: [string, string][],
): MovieWriteArgs["movieResolution"] {
  return {
    failedRemoteKeys: new Map(),
    movieIdByRemoteKey: new Map(entries),
    remoteMoviesByKey: new Map(),
  };
}

describe("Trakt movie pull write planner", () => {
  it("plans media statuses and watch activity rows for movie pull imports", () => {
    const result = __traktSyncTestHooks.createPullResult();
    const historyMovie = remoteMovie({
      key: "trakt:101",
      title: "Perfect Blue",
      traktId: "101",
      year: 1997,
    });
    const watchlistMovie: RemoteTraktWatchlistState = {
      ...remoteMovie({
        key: "tmdb:202",
        title: "Paprika",
        tmdbId: 202,
        year: 2006,
      }),
      listedAt: "2026-05-02T10:00:00.000Z",
    };
    const ratingMovie: RemoteTraktRatingState = {
      ...remoteMovie({
        imdbId: "tt303",
        key: "imdb:tt303",
        title: "Millennium Actress",
        year: 2001,
      }),
      ratedAt: "2026-05-03T10:00:00.000Z",
      rating: 9,
    };

    const plan = __traktSyncTestHooks.planPullUserMovieWrites({
      existingUserMovies: new Map(),
      historyStates: [{
        item: {
          id: 9001,
          movie: {
            ids: { trakt: 101 },
            title: "Perfect Blue",
            year: 1997,
          },
          type: "movie",
          watched_at: "2026-05-01T10:00:00.000Z",
        },
        movie: historyMovie,
      }],
      movieResolution: {
        failedRemoteKeys: new Map(),
        movieIdByRemoteKey: new Map([
          ["trakt:101", "media-history"],
          ["tmdb:202", "media-watchlist"],
          ["imdb:tt303", "media-rating"],
        ]),
        remoteMoviesByKey: new Map(),
      },
      pendingMovieIds: new Set(),
      ratingStates: [ratingMovie],
      removedRatingKeys: [],
      removedWatchlistKeys: [],
      result,
      watchlistStates: [watchlistMovie],
    });

    expect(plan.deleteMediaIds).toEqual([]);
    expect(plan.newestWatchedAt).toBe("2026-05-01T10:00:00.000Z");
    expect(plan.watchActivityRows).toEqual([{
      episode_id: null,
      media_id: "media-history",
      provider_event_id: "trakt:history:9001",
      source: "trakt_sync",
      user_id: "",
      watched_at: "2026-05-01T10:00:00.000Z",
    }]);
    expect(plan.upserts).toEqual(expect.arrayContaining([
      {
        completedAt: null,
        completionMode: null,
        lastWatchedAt: "2026-05-01T10:00:00.000Z",
        mediaId: "media-history",
        personalRating: null,
        status: "done",
        watchlistedAt: null,
      },
      {
        completedAt: null,
        completionMode: null,
        lastWatchedAt: null,
        mediaId: "media-watchlist",
        personalRating: null,
        status: "wishlist",
        watchlistedAt: "2026-05-02T10:00:00.000Z",
      },
      {
        completedAt: null,
        completionMode: null,
        lastWatchedAt: null,
        mediaId: "media-rating",
        personalRating: 9,
        status: "done",
        watchlistedAt: null,
      },
    ]));
    expect(result.historyImported).toBe(1);
    expect(result.watchlistImported).toBe(1);
    expect(result.ratingsImported).toBe(1);
  });

  it("does not downgrade done movies that also appear in the Trakt watchlist", () => {
    const result = __traktSyncTestHooks.createPullResult();

    const plan = __traktSyncTestHooks.planPullUserMovieWrites({
      existingUserMovies: new Map([
        ["media-done", draft({
          completedAt: "2026-05-01T10:00:00.000Z",
          completionMode: "manual",
          lastWatchedAt: "2026-05-01T10:00:00.000Z",
          mediaId: "media-done",
          personalRating: 8,
          status: "done",
        })],
      ]),
      historyStates: [],
      movieResolution: movieResolution([["trakt:101", "media-done"]]),
      pendingMovieIds: new Set(),
      ratingStates: [],
      removedRatingKeys: [],
      removedWatchlistKeys: [],
      result,
      watchlistStates: [{
        ...remoteMovie({
          key: "trakt:101",
          title: "Perfect Blue",
          traktId: "101",
          year: 1997,
        }),
        listedAt: "2026-05-02T10:00:00.000Z",
      }],
    });

    expect(plan).toMatchObject({
      deleteMediaIds: [],
      upserts: [],
      watchActivityRows: [],
    });
    expect(result.watchlistImported).toBe(0);
  });

  it("removes only unpending wishlist and rating state from snapshots", () => {
    const result = __traktSyncTestHooks.createPullResult();

    const plan = __traktSyncTestHooks.planPullUserMovieWrites({
      existingUserMovies: new Map([
        ["media-remove-watchlist", draft({
          mediaId: "media-remove-watchlist",
          status: "wishlist",
          watchlistedAt: "2026-05-01T10:00:00.000Z",
        })],
        ["media-pending-watchlist", draft({
          mediaId: "media-pending-watchlist",
          status: "wishlist",
          watchlistedAt: "2026-05-01T10:00:00.000Z",
        })],
        ["media-clear-rating", draft({
          lastWatchedAt: "2026-05-02T10:00:00.000Z",
          mediaId: "media-clear-rating",
          personalRating: 7,
          status: "done",
        })],
        ["media-pending-rating", draft({
          lastWatchedAt: "2026-05-03T10:00:00.000Z",
          mediaId: "media-pending-rating",
          personalRating: 9,
          status: "done",
        })],
      ]),
      historyStates: [],
      movieResolution: movieResolution([
        ["tmdb:201", "media-remove-watchlist"],
        ["tmdb:202", "media-pending-watchlist"],
        ["tmdb:203", "media-clear-rating"],
        ["tmdb:204", "media-pending-rating"],
      ]),
      pendingMovieIds: new Set(["media-pending-watchlist", "media-pending-rating"]),
      ratingStates: [],
      removedRatingKeys: ["tmdb:203", "tmdb:204"],
      removedWatchlistKeys: ["tmdb:201", "tmdb:202"],
      result,
      watchlistStates: [],
    });

    expect(plan.deleteMediaIds).toEqual(["media-remove-watchlist"]);
    expect(plan.upserts).toEqual([{
      completedAt: null,
      completionMode: null,
      lastWatchedAt: "2026-05-02T10:00:00.000Z",
      mediaId: "media-clear-rating",
      personalRating: null,
      status: "done",
      watchlistedAt: null,
    }]);
    expect(result.watchlistRemoved).toBe(1);
    expect(result.ratingsCleared).toBe(1);
  });

  it("merges same-media history and rating state without re-applying watchlist", () => {
    const result = __traktSyncTestHooks.createPullResult();
    const movie = remoteMovie({
      key: "trakt:101",
      title: "Perfect Blue",
      traktId: "101",
      year: 1997,
    });

    const plan = __traktSyncTestHooks.planPullUserMovieWrites({
      existingUserMovies: new Map([
        ["media-shared", draft({
          completedAt: "2026-04-30T10:00:00.000Z",
          completionMode: "manual",
          lastWatchedAt: "2026-05-03T10:00:00.000Z",
          mediaId: "media-shared",
          personalRating: 6,
          status: "wishlist",
          watchlistedAt: "2026-04-01T10:00:00.000Z",
        })],
      ]),
      historyStates: [{
        item: {
          id: 9001,
          movie: { ids: { trakt: 101 }, title: "Perfect Blue", year: 1997 },
          type: "movie",
          watched_at: "2026-05-01T10:00:00.000Z",
        },
        movie,
      }],
      movieResolution: movieResolution([["trakt:101", "media-shared"]]),
      pendingMovieIds: new Set(),
      ratingStates: [{
        ...movie,
        ratedAt: "2026-05-02T10:00:00.000Z",
        rating: 9,
      }],
      removedRatingKeys: [],
      removedWatchlistKeys: [],
      result,
      watchlistStates: [{
        ...movie,
        listedAt: "2026-05-02T10:00:00.000Z",
      }],
    });

    expect(plan.upserts).toEqual([{
      completedAt: "2026-04-30T10:00:00.000Z",
      completionMode: "manual",
      lastWatchedAt: "2026-05-03T10:00:00.000Z",
      mediaId: "media-shared",
      personalRating: 9,
      status: "done",
      watchlistedAt: null,
    }]);
    expect(plan.newestWatchedAt).toBe("2026-05-01T10:00:00.000Z");
    expect(result.historyImported).toBe(1);
    expect(result.watchlistImported).toBe(0);
    expect(result.ratingsImported).toBe(1);
  });

  it("records skipped and failed imports when remote movie resolution is missing", () => {
    const result = __traktSyncTestHooks.createPullResult();

    const plan = __traktSyncTestHooks.planPullUserMovieWrites({
      existingUserMovies: new Map(),
      historyStates: [{
        item: {
          id: 9001,
          movie: { ids: { tmdb: 201 }, title: "Unmapped", year: 2000 },
          type: "movie",
          watched_at: "2026-05-01T10:00:00.000Z",
        },
        movie: remoteMovie({
          key: "tmdb:201",
          title: "Unmapped",
          tmdbId: 201,
          year: 2000,
        }),
      }],
      movieResolution: {
        failedRemoteKeys: new Map([["tmdb:202", "provider lookup failed"]]),
        movieIdByRemoteKey: new Map(),
        remoteMoviesByKey: new Map(),
      },
      pendingMovieIds: new Set(),
      ratingStates: [],
      removedRatingKeys: [],
      removedWatchlistKeys: [],
      result,
      watchlistStates: [{
        ...remoteMovie({
          key: "tmdb:202",
          title: "Failed",
          tmdbId: 202,
          year: 2001,
        }),
        listedAt: "2026-05-02T10:00:00.000Z",
      }],
    });

    expect(plan).toEqual({
      deleteMediaIds: [],
      newestWatchedAt: null,
      upserts: [],
      watchActivityRows: [],
    });
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.retryableFailures).toBe(1);
    expect(result.failureSamples).toEqual([
      "watchlist:tmdb:202: provider lookup failed",
    ]);
  });

  it("preserves wishlist state for rating-only imports and ignores nonmatching removals", () => {
    const result = __traktSyncTestHooks.createPullResult();

    const plan = __traktSyncTestHooks.planPullUserMovieWrites({
      existingUserMovies: new Map([
        ["media-rated-wishlist", draft({
          mediaId: "media-rated-wishlist",
          status: "wishlist",
          watchlistedAt: "2026-05-01T10:00:00.000Z",
        })],
        ["media-done-watchlist-removal", draft({
          lastWatchedAt: "2026-05-02T10:00:00.000Z",
          mediaId: "media-done-watchlist-removal",
          status: "done",
        })],
        ["media-unrated", draft({
          mediaId: "media-unrated",
          personalRating: null,
          status: "done",
        })],
      ]),
      historyStates: [],
      movieResolution: movieResolution([
        ["tmdb:301", "media-rated-wishlist"],
        ["tmdb:302", "media-done-watchlist-removal"],
        ["tmdb:303", "media-unrated"],
      ]),
      pendingMovieIds: new Set(),
      ratingStates: [{
        ...remoteMovie({
          key: "tmdb:301",
          title: "Paprika",
          tmdbId: 301,
          year: 2006,
        }),
        ratedAt: "2026-05-03T10:00:00.000Z",
        rating: 8,
      }],
      removedRatingKeys: ["tmdb:303"],
      removedWatchlistKeys: ["tmdb:302"],
      result,
      watchlistStates: [],
    });

    expect(plan.deleteMediaIds).toEqual([]);
    expect(plan.upserts).toEqual([{
      completedAt: null,
      completionMode: null,
      lastWatchedAt: null,
      mediaId: "media-rated-wishlist",
      personalRating: 8,
      status: "wishlist",
      watchlistedAt: "2026-05-01T10:00:00.000Z",
    }]);
    expect(result.ratingsImported).toBe(1);
    expect(result.ratingsCleared).toBe(0);
    expect(result.watchlistRemoved).toBe(0);
  });
});
