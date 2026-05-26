import { describe, expect, it } from "vitest";

import {
  toMovieCastPayloads,
  toMoviePayload,
  toMovieSearchResponse,
  toMovieSearchResult,
  toShowPayload,
  toTmdbShowIngestPayload,
  toTmdbMovieIngestPayload,
  toTvSearchResponse,
} from "@/lib/providers/tmdb/adapters";
import type {
  TmdbMovieCredits,
  TmdbMovieDetails,
  TmdbMovieSearchResponse,
  TmdbMovieSearchResult,
  TmdbTvDetails,
  TmdbTvSearchResponse,
  TmdbTvSeasonDetails,
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
      localMediaId: "movie-1",
      mediaType: "movie",
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
          localMediaId: null,
          mediaType: "movie",
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

  it("normalizes TV search results", () => {
    const response: TmdbTvSearchResponse = {
      page: 1,
      results: [
        {
          id: 1396,
          name: " Breaking Bad ",
          original_name: "Breaking Bad",
          first_air_date: "2008-01-20",
          original_language: "en",
          overview: "  A chemistry teacher   turns to crime.  ",
          poster_path: "/poster.jpg",
          backdrop_path: "/backdrop.jpg",
          genre_ids: [18, 80],
          vote_average: 8.947,
          vote_count: 15000,
        },
      ],
      total_pages: 2,
      total_results: 21,
    };

    expect(toTvSearchResponse("bad", response, new Map([
      [
        1396,
        {
          currentStatus: "wishlist",
          localMediaId: "show-1",
          personalRating: 8,
        },
      ],
    ]))).toEqual({
      query: "bad",
      page: 1,
      totalPages: 2,
      totalResults: 21,
      results: [
        {
          mediaType: "show",
          tmdbId: 1396,
          localMediaId: "show-1",
          title: "Breaking Bad",
          originalTitle: "Breaking Bad",
          releaseDate: null,
          releaseYear: null,
          firstAirDate: "2008-01-20",
          firstAirYear: 2008,
          originalLanguage: "en",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          overviewSnippet: "A chemistry teacher turns to crime.",
          genreIds: [18, 80],
          popularity: null,
          alreadyInLibrary: true,
          currentStatus: "wishlist",
          detailUrl: "/show/tmdb/1396",
          personalRating: 8,
          tmdbVoteAverage: 8.9,
          tmdbVoteCount: 15000,
        },
      ],
    });
  });

  it("maps TV details into show media metadata", () => {
    const detail: TmdbTvDetails = {
      id: 1396,
      name: " Example Show ",
      original_name: " Original Show ",
      first_air_date: "bad-date",
      original_language: " en ",
      overview: "",
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      episode_run_time: [0, 47],
      vote_average: 8.94,
      vote_count: 15000,
      popularity: 450.5,
      number_of_seasons: 5,
      number_of_episodes: 62,
      genres: [{ id: 18, name: " Drama " }],
      networks: [{ id: 174, name: " AMC " }],
      production_companies: [{ id: 33742, name: " High Bridge " }],
    };

    expect(toShowPayload(detail)).toEqual({
      tmdbId: 1396,
      title: "Example Show",
      originalTitle: "Original Show",
      firstAirDate: null,
      primaryGenreId: 18,
      primaryGenreName: "Drama",
      originalLanguage: "en",
      overview: null,
      posterPath: "/poster.jpg",
      backdropPath: "/backdrop.jpg",
      runtimeMinutes: 47,
      tmdbVoteAverage: 8.9,
      tmdbVoteCount: 15000,
      popularity: 450.5,
      studio: "High Bridge",
      network: "AMC",
      seasonCount: 5,
      episodeCount: 62,
    });
  });

  it("builds a show ingest payload with sorted season episodes", () => {
    const detail: TmdbTvDetails = {
      id: 1396,
      name: "Example Show",
      first_air_date: "2008-01-20",
    };
    const season: TmdbTvSeasonDetails = {
      id: 3572,
      name: "Season 1",
      poster_path: "/season.jpg",
      season_number: 1,
      episodes: [
        {
          id: 62086,
          name: "Second",
          air_date: "2008-01-27",
          episode_number: 2,
          runtime: 48,
          season_number: 1,
          still_path: "/second.jpg",
        },
        {
          id: 62085,
          name: " Pilot ",
          air_date: "2008-01-20",
          episode_number: 1,
          runtime: 0,
          season_number: 1,
          still_path: "/pilot.jpg",
        },
      ],
    };

    expect(toTmdbShowIngestPayload(detail, [season])).toEqual({
      show: expect.objectContaining({
        firstAirDate: "2008-01-20",
        title: "Example Show",
        tmdbId: 1396,
      }),
      episodes: [
        {
          tmdbId: 62085,
          seasonNumber: 1,
          episodeNumber: 1,
          title: "Pilot",
          airDate: "2008-01-20",
          runtimeMinutes: null,
          overview: null,
          posterPath: "/season.jpg",
          stillPath: "/pilot.jpg",
        },
        {
          tmdbId: 62086,
          seasonNumber: 1,
          episodeNumber: 2,
          title: "Second",
          airDate: "2008-01-27",
          runtimeMinutes: 48,
          overview: null,
          posterPath: "/season.jpg",
          stillPath: "/second.jpg",
        },
      ],
    });
  });
});
