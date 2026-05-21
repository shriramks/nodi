import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/tmdb/client", () => ({
  discoverTmdbMovies: vi.fn(),
  getTmdbCollectionDetails: vi.fn(),
  getTmdbMovieCredits: vi.fn(),
  getTmdbMovieDetails: vi.fn(),
  getTmdbMovieKeywords: vi.fn(),
  getTmdbMovieRecommendations: vi.fn(),
  getTmdbSimilarMovies: vi.fn(),
}));

import {
  rankRelatedMovies,
  type RelatedSeed,
} from "@/lib/providers/tmdb/related";
import type { TmdbMovieSearchResult } from "@/lib/providers/tmdb/client";

function movie({
  id,
  title,
  ...overrides
}: Partial<TmdbMovieSearchResult> & { id: number; title: string }): TmdbMovieSearchResult {
  return {
    id,
    original_title: title,
    title,
    ...overrides,
  };
}

const seed: RelatedSeed = {
  collectionId: 900,
  crewIds: [11],
  genreIds: [18, 53],
  keywordIds: [101, 202],
  originalLanguage: "ja",
  peopleIds: [11, 22, 33],
  releaseYear: 1997,
};

describe("TMDB related movies", () => {
  it("boosts collection siblings and titles found by multiple related sources", () => {
    const ranked = rankRelatedMovies(10, seed, [
      {
        source: "recommendations",
        results: [
          movie({
            id: 20,
            title: "Broad Hit",
            genre_ids: [28],
            original_language: "en",
            popularity: 250,
            release_date: "2020-01-01",
            vote_average: 8.1,
            vote_count: 5000,
          }),
          movie({
            id: 30,
            title: "Shared Mood",
            genre_ids: [18, 53],
            original_language: "ja",
            popularity: 20,
            release_date: "1998-01-01",
            vote_average: 7.4,
            vote_count: 300,
          }),
        ],
      },
      {
        source: "similar",
        results: [
          movie({
            id: 30,
            title: "Shared Mood",
            genre_ids: [18, 53],
            original_language: "ja",
            popularity: 20,
            release_date: "1998-01-01",
            vote_average: 7.4,
            vote_count: 300,
          }),
        ],
      },
      {
        source: "keyword-discover",
        results: [
          movie({
            id: 40,
            title: "Keyword Match",
            genre_ids: [18],
            original_language: "ja",
            popularity: 15,
            release_date: "1995-01-01",
            vote_average: 7.8,
            vote_count: 100,
          }),
        ],
      },
      {
        source: "collection",
        results: [
          movie({ id: 10, title: "Current Movie" }),
          movie({
            id: 50,
            title: "Direct Sequel",
            genre_ids: [18, 53],
            original_language: "ja",
            release_date: "1999-01-01",
          }),
        ],
      },
    ]);

    expect(ranked.map((item) => item.id)).toEqual([50, 30, 40, 20]);
  });

  it("filters invalid, adult, and current movie candidates", () => {
    const ranked = rankRelatedMovies(10, seed, [
      {
        source: "recommendations",
        results: [
          movie({ id: 10, title: "Current Movie" }),
          movie({ adult: true, id: 20, title: "Adult Movie" }),
          movie({ id: 30, title: "   " }),
          movie({ id: 40, title: "Valid Movie" }),
        ],
      },
    ]);

    expect(ranked).toEqual([
      {
        id: 40,
        posterPath: null,
        releaseYear: null,
        title: "Valid Movie",
      },
    ]);
  });
});
