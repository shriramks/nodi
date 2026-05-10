import { describe, expect, it } from "vitest";

import {
  buildLibraryStats,
  type RatingAnalyticsRow,
  type TagAnalyticsRow,
  type WatchLogAnalyticsRow,
} from "@/lib/db/queries/stats-transforms";

describe("stats transforms", () => {
  it("derives watched counts, event counts, runtime, buckets, and breakdowns", () => {
    const watchRows: WatchLogAnalyticsRow[] = [
      {
        id: "log-1",
        movie_id: "movie-a",
        watched_at: "2026-01-10T12:00:00.000Z",
        movies: {
          id: "movie-a",
          original_language: "ja",
          primary_genre_name: "Animation",
          runtime_minutes: 80,
          release_year: 2000,
        },
      },
      {
        id: "log-2",
        movie_id: "movie-a",
        watched_at: "2026-02-10T12:00:00.000Z",
        movies: {
          id: "movie-a",
          original_language: "ja",
          primary_genre_name: "Animation",
          runtime_minutes: 80,
          release_year: 2000,
        },
      },
      {
        id: "log-3",
        movie_id: "movie-b",
        watched_at: "2026-03-10T12:00:00.000Z",
        movies: {
          id: "movie-b",
          original_language: null,
          primary_genre_name: null,
          runtime_minutes: 95,
          release_year: null,
        },
      },
    ];
    const tagRows: TagAnalyticsRow[] = [
      { movie_id: "movie-a", tags: { id: "tag-1", name: "Mind-bending" } },
      { movie_id: "movie-a", tags: { id: "tag-1", name: "Mind-bending" } },
      { movie_id: "movie-c", tags: { id: "tag-2", name: "Ignored" } },
    ];
    const ratingRows: RatingAnalyticsRow[] = [
      { personal_rating: 8 },
      { personal_rating: 8 },
      { personal_rating: 10 },
    ];

    const stats = buildLibraryStats(watchRows, tagRows, ratingRows);

    expect(stats.watchedCount).toBe(2);
    expect(stats.watchEventCount).toBe(3);
    expect(stats.runtimeMinutes).toBe(255);
    expect(stats.genreBreakdown).toEqual([
      { count: 1, key: "animation", label: "Animation", percentage: 50 },
      { count: 1, key: "unknown", label: "Unknown", percentage: 50 },
    ]);
    expect(stats.languageBreakdown).toEqual([
      { count: 1, key: "ja", label: "Japanese", percentage: 50 },
      { count: 1, key: "unknown", label: "Unknown", percentage: 50 },
    ]);
    expect(stats.tagBreakdown).toEqual([
      { count: 1, key: "tag-1", label: "Mind-bending", percentage: 50 },
    ]);
    // monthBuckets: all months from earliest to latest watch date
    expect(stats.monthBuckets.map((b) => [b.key, b.count])).toEqual([
      ["2026-01", 1],
      ["2026-02", 1],
      ["2026-03", 1],
    ]);
    expect(stats.yearBuckets.map((b) => [b.key, b.count])).toEqual([["2026", 3]]);
    expect(stats.ratingBreakdown.find((b) => b.rating === 8)?.count).toBe(2);
    expect(stats.ratingBreakdown.find((b) => b.rating === 10)?.count).toBe(1);
    expect(stats.ratingBreakdown.find((b) => b.rating === 5)?.count).toBe(0);
  });

  it("returns empty collections when there are no watch events", () => {
    expect(buildLibraryStats([], [], [])).toMatchObject({
      genreBreakdown: [],
      languageBreakdown: [],
      monthBuckets: [],
      ratingBreakdown: [],
      runtimeMinutes: 0,
      tagBreakdown: [],
      watchEventCount: 0,
      watchedCount: 0,
      yearBuckets: [],
    });
  });
});
