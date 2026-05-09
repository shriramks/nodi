import { describe, expect, it } from "vitest";

import {
  getTraktMovieKey,
  toRemoteTraktRatingState,
  toRemoteTraktWatchlistState,
  toTraktMovieIds,
  toTraktSyncMovie,
} from "@/lib/providers/trakt/adapters";
import type { ProviderMapping } from "@/lib/db/types";

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
        id: "mapping-1",
        created_at: "2026-01-01T00:00:00.000Z",
        movie_id: "movie-1",
        provider: "trakt",
        provider_movie_id: "123",
      },
      {
        id: "mapping-2",
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
});
