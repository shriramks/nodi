import { describe, expect, it } from "vitest";

import {
  validateMoviePayload,
  validateRatingPayload,
  validateWatchActionPayload,
} from "@/lib/db/validation";

const movieId = "00000000-0000-4000-8000-000000000000";

describe("database validation", () => {
  it("trims movie payload strings and normalizes empty optionals", () => {
    expect(
      validateMoviePayload({
        tmdbId: 437,
        imdbId: " tt0119698 ",
        title: " Perfect Blue ",
        originalTitle: "",
        releaseDate: "1997-02-28",
        tmdbVoteAverage: 8.1,
      }),
    ).toMatchObject({
      imdbId: "tt0119698",
      originalTitle: null,
      releaseDate: "1997-02-28",
      title: "Perfect Blue",
      tmdbId: 437,
      tmdbVoteAverage: 8.1,
    });
  });

  it("rejects impossible ISO calendar dates", () => {
    expect(() =>
      validateMoviePayload({
        tmdbId: 1,
        title: "Invalid date",
        releaseDate: "2026-02-30",
      }),
    ).toThrow("Expected releaseDate to be an ISO date in YYYY-MM-DD format.");
  });

  it("requires watchedAt when a movie is marked watched", () => {
    expect(() =>
      validateWatchActionPayload({
        movieId,
        status: "watched",
      }),
    ).toThrow("Expected watchedAt when status is watched.");
  });

  it("preserves whether personalRating was omitted or explicitly cleared", () => {
    const omittedRating = validateWatchActionPayload({
      movieId,
      status: "to_watch",
    });
    const clearedRating = validateWatchActionPayload({
      movieId,
      personalRating: null,
      status: "to_watch",
    });

    expect(Object.hasOwn(omittedRating, "personalRating")).toBe(false);
    expect(Object.hasOwn(clearedRating, "personalRating")).toBe(true);
    expect(clearedRating.personalRating).toBeNull();
  });

  it("rejects ratings outside the app range", () => {
    expect(() => validateRatingPayload({ personalRating: 8.25 })).toThrow(
      "Expected personalRating to use at most 1 decimal place.",
    );
    expect(() => validateRatingPayload({ personalRating: 11 })).toThrow(
      "Expected personalRating to be at most 10.",
    );
  });
});
