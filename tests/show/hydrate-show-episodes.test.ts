import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ShowDetail } from "@/lib/db/queries";
import { AppError } from "@/lib/errors";

const ingestTmdbShow = vi.fn();
const refreshShowCompletionStateIfTracked = vi.fn();
const getTmdbTvDetailsWithAuth = vi.fn();
const getTmdbTvSeasonDetailsWithAuth = vi.fn();
const loadTmdbAuthForCurrentUser = vi.fn();

vi.mock("@/lib/db/mutations", () => ({
  ingestTmdbShow: (...args: unknown[]) => ingestTmdbShow(...args),
  refreshShowCompletionStateIfTracked: (...args: unknown[]) =>
    refreshShowCompletionStateIfTracked(...args),
}));

vi.mock("@/lib/providers/tmdb/client", () => ({
  getTmdbTvDetailsWithAuth: (...args: unknown[]) => getTmdbTvDetailsWithAuth(...args),
  getTmdbTvSeasonDetailsWithAuth: (...args: unknown[]) => getTmdbTvSeasonDetailsWithAuth(...args),
  loadTmdbAuthForCurrentUser: (...args: unknown[]) => loadTmdbAuthForCurrentUser(...args),
}));

import { hydrateShowEpisodesOnDemand } from "@/lib/show/hydrate-show-episodes";

function userMedia(overrides: Partial<NonNullable<ShowDetail["userMedia"]>> = {}) {
  return {
    added_at: "2026-05-28T00:00:00.000Z",
    completed_at: null,
    completion_mode: null,
    id: "20000000-0000-4000-8000-000000000001",
    last_watched_at: "2026-05-28T00:00:00.000Z",
    media_id: "00000000-0000-4000-8000-000000000001",
    personal_rating: null,
    status: "watching" as const,
    updated_at: "2026-05-28T00:00:00.000Z",
    user_id: "30000000-0000-4000-8000-000000000001",
    watchlisted_at: null,
    ...overrides,
  } satisfies NonNullable<ShowDetail["userMedia"]>;
}

function showDetail(overrides: Partial<ShowDetail> = {}): ShowDetail {
  return {
    backdrop_path: null,
    cast: [],
    created_at: "2026-05-28T00:00:00.000Z",
    episode_count: 1,
    first_air_date: "2005-09-13",
    id: "00000000-0000-4000-8000-000000000001",
    metadata_updated_at: "2026-05-28T00:00:00.000Z",
    network: null,
    original_language: "en",
    original_title: "Supernatural",
    overview: null,
    popularity: null,
    poster_path: null,
    primary_genre_id: null,
    primary_genre_name: null,
    providerMappings: [
      { provider: "tmdb", provider_id: "1622", provider_media_type: "show" },
    ],
    release_date: null,
    release_year: 2005,
    runtime_minutes: null,
    season_count: null,
    seasons: [
      {
        seasonNumber: 1,
        episodes: [
          {
            air_date: "2005-09-13",
            created_at: "2026-05-28T00:00:00.000Z",
            episode_number: 1,
            id: "10000000-0000-4000-8000-000000000001",
            metadata_updated_at: "2026-05-28T00:00:00.000Z",
            overview: null,
            poster_path: null,
            runtime_minutes: 44,
            season_number: 1,
            show_id: "00000000-0000-4000-8000-000000000001",
            still_path: null,
            title: "Pilot",
            watchActivity: [],
          },
        ],
      },
    ],
    studio: null,
    tags: [],
    title: "Supernatural",
    tmdb_enriched_at: "2026-05-28T00:00:00.000Z",
    tmdb_vote_average: null,
    tmdb_vote_count: null,
    type: "show",
    userMedia: null,
    watchActivity: [],
    ...overrides,
  } as unknown as ShowDetail;
}

describe("hydrateShowEpisodesOnDemand live TMDB count check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pin "now" to the fixture's metadata_updated_at so the existing
    // staleness gate (STALE_METADATA_DAYS) stays fresh and the live count
    // check below is what's actually under test.
    vi.setSystemTime(new Date("2026-05-28T00:00:00.000Z"));
    loadTmdbAuthForCurrentUser.mockResolvedValue({ apiToken: "token" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips the live check entirely for shows with no TMDB mapping", async () => {
    const result = await hydrateShowEpisodesOnDemand(showDetail({ providerMappings: [] }));

    expect(result).toEqual({ hydrated: false, failed: false });
    expect(getTmdbTvDetailsWithAuth).not.toHaveBeenCalled();
  });

  it("skips the live check for shows that are not actively tracked", async () => {
    const result = await hydrateShowEpisodesOnDemand(
      showDetail({
        userMedia: userMedia({
          status: "done",
          completion_mode: "manual",
          completed_at: "2026-05-28T00:00:00.000Z",
        }),
      }),
    );

    expect(result).toEqual({ hydrated: false, failed: false });
    expect(getTmdbTvDetailsWithAuth).not.toHaveBeenCalled();
  });

  it("does nothing when TMDB's episode count matches the local count", async () => {
    getTmdbTvDetailsWithAuth.mockResolvedValue({ id: 1622, number_of_episodes: 1, seasons: [] });

    const result = await hydrateShowEpisodesOnDemand(
      showDetail({ userMedia: userMedia({ status: "watching" }) }),
    );

    expect(result).toEqual({ hydrated: false, failed: false });
    expect(ingestTmdbShow).not.toHaveBeenCalled();
  });

  it("hydrates immediately when TMDB reports more episodes than are stored locally", async () => {
    getTmdbTvDetailsWithAuth.mockResolvedValue({
      id: 1622,
      number_of_episodes: 2,
      seasons: [{ season_number: 1, episode_count: 2 }],
    });
    getTmdbTvSeasonDetailsWithAuth.mockResolvedValue({ episodes: [] });
    ingestTmdbShow.mockResolvedValue(undefined);
    refreshShowCompletionStateIfTracked.mockResolvedValue(undefined);

    const result = await hydrateShowEpisodesOnDemand(
      showDetail({ userMedia: userMedia({ status: "watching" }) }),
    );

    expect(result).toEqual({ hydrated: true, failed: false });
    // The detail already fetched for the count check is reused, not re-fetched.
    expect(getTmdbTvDetailsWithAuth).toHaveBeenCalledTimes(1);
    expect(ingestTmdbShow).toHaveBeenCalledTimes(1);
  });

  it("swallows a 404 from the live check as 'nothing to sync'", async () => {
    getTmdbTvDetailsWithAuth.mockRejectedValue(
      new AppError("not found", { code: "NOT_FOUND", status: 404 }),
    );

    const result = await hydrateShowEpisodesOnDemand(
      showDetail({ userMedia: userMedia({ status: "watching" }) }),
    );

    expect(result).toEqual({ hydrated: false, failed: false });
  });

  it("reports failed: true when the live check hits a real error", async () => {
    getTmdbTvDetailsWithAuth.mockRejectedValue(new Error("network down"));

    const result = await hydrateShowEpisodesOnDemand(
      showDetail({ userMedia: userMedia({ status: "watching" }) }),
    );

    expect(result).toEqual({ hydrated: false, failed: true });
  });
});
