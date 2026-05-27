import { describe, expect, it } from "vitest";

import {
  getTraktMovieKey,
  getTraktShowKey,
  toRemoteTraktEpisodeHistoryState,
  toRemoteTraktRatingState,
  toRemoteTraktShowRatingState,
  toRemoteTraktShowWatchlistState,
  toRemoteTraktWatchlistState,
  toTraktHistoryEpisode,
  toTraktMovieIds,
  toTraktRatedShow,
  toTraktSyncShow,
  toTraktSyncMovie,
} from "@/lib/providers/trakt/adapters";
import type { MediaProviderMapping, ProviderMapping } from "@/lib/db/types";

const movie = {
  id: "movie-1",
  imdb_id: "tt001",
  release_year: 1997,
  title: "Perfect Blue",
  tmdb_id: 437,
};

describe("Trakt adapters", () => {
  it("builds sync ids from local movie metadata and provider mappings", () => {
    const mappings: ProviderMapping[] = [
      {
        created_at: "2026-01-01T00:00:00.000Z",
        movie_id: "movie-1",
        provider: "trakt",
        provider_movie_id: "123",
      },
      {
        created_at: "2026-01-01T00:00:00.000Z",
        movie_id: "movie-1",
        provider: "tmdb",
        provider_movie_id: "999",
      },
    ];

    expect(toTraktMovieIds(movie, mappings)).toEqual({
      imdb: "tt001",
      tmdb: 999,
      trakt: 123,
    });
  });

  it("builds the outbound sync movie payload", () => {
    expect(toTraktSyncMovie(movie)).toEqual({
      ids: {
        imdb: "tt001",
        tmdb: 437,
      },
      title: "Perfect Blue",
      year: 1997,
    });
  });

  it("uses the strongest available remote id as the stable movie key", () => {
    expect(
      getTraktMovieKey({
        ids: { imdb: "tt001", tmdb: 437, trakt: 123 },
      }),
    ).toBe("trakt:123");
    expect(getTraktMovieKey({ ids: { imdb: "tt001", tmdb: 437 } })).toBe("tmdb:437");
    expect(getTraktMovieKey({ ids: { imdb: " tt001 " } })).toBe("imdb:tt001");
    expect(getTraktMovieKey({ ids: {} })).toBeNull();
  });

  it("normalizes remote watchlist and rating state", () => {
    expect(
      toRemoteTraktWatchlistState({
        listed_at: "2026-01-01T00:00:00.000Z",
        movie: {
          ids: { tmdb: 437 },
          title: "Perfect Blue",
          year: 1997,
        },
      }),
    ).toMatchObject({
      key: "tmdb:437",
      listedAt: "2026-01-01T00:00:00.000Z",
      title: "Perfect Blue",
      year: 1997,
    });

    expect(
      toRemoteTraktRatingState({
        rated_at: "2026-01-02T00:00:00.000Z",
        rating: 12,
        movie: {
          ids: { trakt: 123 },
        },
      }),
    ).toMatchObject({
      key: "trakt:123",
      ratedAt: "2026-01-02T00:00:00.000Z",
      rating: 10,
    });

    expect(
      toRemoteTraktRatingState({
        rated_at: "2026-01-02T00:00:00.000Z",
        rating: 8.5,
        movie: {
          ids: { trakt: 123 },
        },
      }),
    ).toBeNull();
  });

  it("builds outbound show and episode payloads", () => {
    const mappings: MediaProviderMapping[] = [
      {
        created_at: "2026-01-01T00:00:00.000Z",
        episode_id: null,
        media_id: "show-1",
        provider: "trakt",
        provider_id: "456",
        provider_media_type: "show",
      },
      {
        created_at: "2026-01-01T00:00:00.000Z",
        episode_id: null,
        media_id: "show-1",
        provider: "tmdb",
        provider_id: "1396",
        provider_media_type: "show",
      },
    ];

    expect(
      toTraktSyncShow({
        first_air_date: "2008-01-20",
        id: "show-1",
        release_year: 2008,
        title: "Breaking Bad",
      }, mappings),
    ).toEqual({
      ids: {
        tmdb: 1396,
        trakt: 456,
      },
      title: "Breaking Bad",
      year: 2008,
    });

    expect(
      toTraktRatedShow({
        first_air_date: "2008-01-20",
        id: "show-1",
        release_year: 2008,
        title: "Breaking Bad",
      }, 9, "2026-05-01T00:00:00.000Z", mappings),
    ).toMatchObject({
      rated_at: "2026-05-01T00:00:00.000Z",
      rating: 9,
    });

    expect(
      toTraktHistoryEpisode(
        {
          episode_number: 1,
          id: "episode-1",
          season_number: 1,
          title: "Pilot",
        },
        "2026-05-02T00:00:00.000Z",
        [{
          created_at: "2026-01-01T00:00:00.000Z",
          episode_id: "episode-1",
          media_id: null,
          provider: "tmdb",
          provider_id: "62085",
          provider_media_type: "episode",
        }],
      ),
    ).toEqual({
      ids: { tmdb: 62085 },
      number: 1,
      season: 1,
      title: "Pilot",
      watched_at: "2026-05-02T00:00:00.000Z",
    });
  });

  it("normalizes remote show and episode state", () => {
    expect(
      getTraktShowKey({
        ids: { tmdb: 1396, trakt: 456 },
      }),
    ).toBe("trakt:456");
    expect(
      toRemoteTraktShowWatchlistState({
        listed_at: "2026-05-01T00:00:00.000Z",
        show: {
          ids: { tmdb: 1396 },
          title: "Breaking Bad",
          year: 2008,
        },
      }),
    ).toMatchObject({
      key: "tmdb:1396",
      listedAt: "2026-05-01T00:00:00.000Z",
      title: "Breaking Bad",
    });
    expect(
      toRemoteTraktShowRatingState({
        rated_at: "2026-05-02T00:00:00.000Z",
        rating: 8,
        show: {
          ids: { trakt: 456 },
        },
      }),
    ).toMatchObject({
      key: "trakt:456",
      ratedAt: "2026-05-02T00:00:00.000Z",
      rating: 8,
    });
    expect(
      toRemoteTraktEpisodeHistoryState({
        episode: {
          ids: { tmdb: 62085 },
          number: 1,
          season: 1,
          title: "Pilot",
        },
        id: 123,
        show: {
          ids: { tmdb: 1396 },
          title: "Breaking Bad",
        },
        watched_at: "2026-05-03T00:00:00.000Z",
      }),
    ).toMatchObject({
      episode: {
        episodeNumber: 1,
        key: "tmdb:62085",
        seasonNumber: 1,
      },
      show: {
        key: "tmdb:1396",
      },
    });
  });
});
