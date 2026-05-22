import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/tmdb/client", () => ({
  discoverTmdbMovies: vi.fn(),
  discoverTmdbMoviesWithAuth: vi.fn(),
  getTmdbCollectionDetails: vi.fn(),
  getTmdbCollectionDetailsWithAuth: vi.fn(),
  getTmdbMovieCredits: vi.fn(),
  getTmdbMovieCreditsWithAuth: vi.fn(),
  getTmdbMovieDetails: vi.fn(),
  getTmdbMovieDetailsWithAppendedResponses: vi.fn(),
  getTmdbMovieDetailsWithAppendedResponsesWithAuth: vi.fn(),
  getTmdbMovieDetailsWithAuth: vi.fn(),
  getTmdbMovieKeywords: vi.fn(),
  getTmdbMovieKeywordsWithAuth: vi.fn(),
  getTmdbMovieRecommendations: vi.fn(),
  getTmdbMovieRecommendationsWithAuth: vi.fn(),
  getTmdbSimilarMovies: vi.fn(),
  getTmdbSimilarMoviesWithAuth: vi.fn(),
}));

import * as tmdbClient from "@/lib/providers/tmdb/client";
import {
  getRelatedTmdbMovies,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses appended movie details instead of separate primary related calls", async () => {
    vi.mocked(tmdbClient.getTmdbMovieDetailsWithAppendedResponses).mockResolvedValue({
      id: 10,
      original_language: "ja",
      original_title: "Seed Movie",
      recommendations: {
        page: 1,
        results: [
          movie({
            id: 20,
            title: "Recommended",
            release_date: "1998-01-01",
          }),
        ],
        total_pages: 1,
        total_results: 1,
      },
      release_date: "1997-01-01",
      similar: {
        page: 1,
        results: [
          movie({
            id: 30,
            title: "Similar",
            release_date: "1999-01-01",
          }),
        ],
        total_pages: 1,
        total_results: 1,
      },
      title: "Seed Movie",
    });

    const related = await getRelatedTmdbMovies(10);

    expect(tmdbClient.getTmdbMovieDetailsWithAppendedResponses).toHaveBeenCalledWith(10, [
      "credits",
      "keywords",
      "recommendations",
      "similar",
    ]);
    expect(tmdbClient.getTmdbMovieDetails).not.toHaveBeenCalled();
    expect(tmdbClient.getTmdbMovieCredits).not.toHaveBeenCalled();
    expect(tmdbClient.getTmdbMovieKeywords).not.toHaveBeenCalled();
    expect(tmdbClient.getTmdbMovieRecommendations).not.toHaveBeenCalled();
    expect(tmdbClient.getTmdbSimilarMovies).not.toHaveBeenCalled();
    expect(related.map((item) => item.id)).toEqual([20, 30]);
  });

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
