import { describe, expect, it, vi } from "vitest";

import type { ShowDetail } from "@/lib/db/queries";
import { needsShowEpisodeHydration } from "@/lib/show/episode-hydration";

function showDetail(overrides: Partial<ShowDetail> = {}): ShowDetail {
  return {
    backdrop_path: null,
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
    providerMappings: [],
    release_date: null,
    release_year: 2005,
    runtime_minutes: null,
    season_count: null,
    seasons: [{
      seasonNumber: 1,
      episodes: [{
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
      }],
    }],
    studio: null,
    tags: [],
    title: "Supernatural",
    tmdb_enriched_at: "2026-05-28T00:00:00.000Z",
    tmdb_vote_average: null,
    tmdb_vote_count: null,
    type: "show",
    updated_at: "2026-05-28T00:00:00.000Z",
    userMedia: null,
    watchActivity: [],
    ...overrides,
  };
}

describe("show episode hydration", () => {
  it("hydrates minimal Trakt shows even when locally watched episodes look complete", () => {
    expect(
      needsShowEpisodeHydration(
        showDetail({
          episode_count: null,
          tmdb_enriched_at: null,
          userMedia: {
            added_at: "2026-05-28T00:00:00.000Z",
            completed_at: "2026-05-28T00:00:00.000Z",
            completion_mode: "auto_all_aired",
            id: "20000000-0000-4000-8000-000000000001",
            last_watched_at: "2026-05-28T00:00:00.000Z",
            media_id: "00000000-0000-4000-8000-000000000001",
            personal_rating: null,
            status: "done",
            updated_at: "2026-05-28T00:00:00.000Z",
            user_id: "30000000-0000-4000-8000-000000000001",
            watchlisted_at: null,
          },
        }),
      ),
    ).toBe(true);
  });

  it("does not hydrate fresh complete TMDB-enriched shows", () => {
    expect(needsShowEpisodeHydration(showDetail())).toBe(false);
  });

  it("hydrates stale watching shows to pick up newly aired episodes", () => {
    vi.setSystemTime(new Date("2026-05-28T00:00:00.000Z"));

    expect(
      needsShowEpisodeHydration(
        showDetail({
          metadata_updated_at: "2026-05-20T00:00:00.000Z",
          userMedia: {
            added_at: "2026-05-28T00:00:00.000Z",
            completed_at: null,
            completion_mode: null,
            id: "20000000-0000-4000-8000-000000000001",
            last_watched_at: "2026-05-28T00:00:00.000Z",
            media_id: "00000000-0000-4000-8000-000000000001",
            personal_rating: null,
            status: "watching",
            updated_at: "2026-05-28T00:00:00.000Z",
            user_id: "30000000-0000-4000-8000-000000000001",
            watchlisted_at: null,
          },
        }),
      ),
    ).toBe(true);

    vi.useRealTimers();
  });
});
