import { describe, expect, it } from "vitest";

import {
  toMovieCastPayloads,
  toMoviePayload,
  toMovieSearchResponse,
  toMovieSearchResult,
  toTmdbMovieIngestPayload,
} from "@/lib/providers/tmdb/adapters";
import type {
  TmdbMovieCredits,
  TmdbMovieDetails,
  TmdbMovieSearchResponse,
  TmdbMovieSearchResult,
} from "@/lib/providers/tmdb/client";

describe("TMDB adapters", () => {
  it("normalizes search results and merges local movie state", () => {
    const result: TmdbMovieSearchResult = {
      id: 437,
      title: "Perfect Blue",
      original_title: "  ",
      release_date: "1997-02-28",
      original_language: "ja",
      overview: "  A pop singer   moves into acting.  ",
      poster_path: "/poster.jpg",
      backdrop_path: null,
      genre_ids: [16, 53],
    };

    expect(
      toMovieSearchResult(result, {
        currentStatus: "watched",
        localMovieId: "movie-1",
        personalRating: 9,
      }),
    ).toMatchObject({
      alreadyInLibrary: true,
      currentStatus: "watched",
      detailUrl: "/movie/tmdb/437",
      localMovieId: "movie-1",
      originalTitle: null,
      overviewSnippet: "A pop singer moves into acting.",
      personalRating: 9,
      releaseYear: 1997,
    });
  });

  it("normalizes search response paging fields", () => {
    const response: TmdbMovieSearchResponse = {
      page: 2,
      results: [
        {
          id: 1,
          title: "Result",
          original_title: "Result",
          release_date: "not-a-date",
        },
      ],
      total_pages: 3,
      total_results: 21,
    };

    expect(toMovieSearchResponse("result", response, new Map())).toMatchObject({
      page: 2,
      query: "result",
      totalPages: 3,
      totalResults: 21,
      results: [
        {
          localMovieId: null,
          releaseDate: null,
          releaseYear: null,
        },
      ],
    });
  });

  it("maps movie details into a validated local movie payload", () => {
    const detail: TmdbMovieDetails = {
      id: 42,
      imdb_id: " tt123 ",
      title: "  ",
      original_title: " Original ",
      release_date: "bad-date",
      original_language: " en ",
      overview: "",
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      runtime: 0,
      vote_average: 7.36,
      vote_count: 120,
      popularity: 33.5,
      genres: [{ id: 18, name: " Drama " }],
    };

    expect(toMoviePayload(detail)).toEqual({
      backdropPath: "/backdrop.jpg",
      imdbId: "tt123",
      originalLanguage: "en",
      originalTitle: "Original",
      overview: null,
      popularity: 33.5,
      posterPath: "/poster.jpg",
      primaryGenreId: 18,
      primaryGenreName: "Drama",
      releaseDate: null,
      runtimeMinutes: null,
      title: "Untitled movie",
      tmdbId: 42,
      tmdbVoteAverage: 7.4,
      tmdbVoteCount: 120,
    });
  });

  it("sorts, filters, and limits cast payloads", () => {
    const credits: TmdbMovieCredits = {
      id: 42,
      cast: [
        { id: 2, name: "Second", character: "  Role B ", order: 2 },
        { id: 0, name: "Invalid", order: 0 },
        { id: 1, name: " First ", character: "", profile_path: "/a.jpg", order: 1 },
      ],
    };

    expect(toMovieCastPayloads(credits, 1)).toEqual([
      {
        cast_order: 1,
        character_name: null,
        name: "First",
        profile_path: "/a.jpg",
        tmdb_person_id: 1,
      },
    ]);
  });

  it("builds a normalized ingest payload from remote detail data", () => {
    const detail: TmdbMovieDetails = {
      id: 42,
      imdb_id: " tt123 ",
      title: " Example ",
      release_date: "2026-05-17",
      genres: [{ id: 18, name: " Drama " }],
    };
    const credits: TmdbMovieCredits = {
      id: 42,
      cast: [
        { id: 2, name: "Second", order: 2 },
        { id: 1, name: " First ", order: 1 },
      ],
    };

    expect(toTmdbMovieIngestPayload(detail, credits)).toEqual({
      movie: expect.objectContaining({
        imdbId: "tt123",
        primaryGenreName: "Drama",
        title: "Example",
        tmdbId: 42,
      }),
      cast: [
        {
          cast_order: 1,
          character_name: null,
          name: "First",
          profile_path: null,
          tmdb_person_id: 1,
        },
        {
          cast_order: 2,
          character_name: null,
          name: "Second",
          profile_path: null,
          tmdb_person_id: 2,
        },
      ],
    });
  });
});
