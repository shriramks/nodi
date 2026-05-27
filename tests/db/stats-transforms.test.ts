import { describe, expect, it } from "vitest";

import {
  buildLibraryStats,
  buildMediaLibraryStats,
  buildWatchedLibrarySummary,
  type MediaStatsRatingRow,
  type MediaStatsStateRow,
  type MediaStatsTagRow,
  type MediaStatsWatchRow,
  type RatingAnalyticsRow,
  type TagAnalyticsRow,
  type WatchLogAnalyticsRow,
  type WatchedLibrarySummaryRow,
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
      { movie_id: "movie-a", personal_rating: 8 },
      { movie_id: "movie-a", personal_rating: 8 },
      { movie_id: "movie-b", personal_rating: 10 },
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

  it("scopes library stats to a watched year while preserving available year options", () => {
    const watchRows: WatchLogAnalyticsRow[] = [
      {
        id: "log-1",
        movie_id: "movie-a",
        watched_at: "2025-12-20T12:00:00.000Z",
        movies: {
          id: "movie-a",
          original_language: "en",
          primary_genre_name: "Drama",
          runtime_minutes: 100,
          release_year: 1999,
        },
      },
      {
        id: "log-2",
        movie_id: "movie-a",
        watched_at: "2026-01-10T12:00:00.000Z",
        movies: {
          id: "movie-a",
          original_language: "en",
          primary_genre_name: "Drama",
          runtime_minutes: 100,
          release_year: 1999,
        },
      },
      {
        id: "log-3",
        movie_id: "movie-b",
        watched_at: "2026-12-10T12:00:00.000Z",
        movies: {
          id: "movie-b",
          original_language: "ko",
          primary_genre_name: "Action",
          runtime_minutes: 90,
          release_year: 2010,
        },
      },
    ];
    const tagRows: TagAnalyticsRow[] = [
      { movie_id: "movie-a", tags: { id: "tag-1", name: "Noir" } },
      { movie_id: "movie-b", tags: { id: "tag-2", name: "Action" } },
    ];
    const ratingRows: RatingAnalyticsRow[] = [
      { movie_id: "movie-a", personal_rating: 8 },
      { movie_id: "movie-b", personal_rating: 6 },
    ];

    const stats = buildLibraryStats(watchRows, tagRows, ratingRows, undefined, "2026");

    expect(stats.watchEventCount).toBe(2);
    expect(stats.watchedCount).toBe(2);
    expect(stats.runtimeMinutes).toBe(190);
    expect(stats.avgRating).toBe(7);
    expect(stats.availableYearBuckets.map((bucket) => [bucket.key, bucket.count])).toEqual([
      ["2025", 1],
      ["2026", 2],
    ]);
    expect(stats.monthBuckets).toHaveLength(12);
    expect(stats.monthBuckets.map((bucket) => [bucket.key, bucket.count])).toEqual([
      ["2026-01", 1],
      ["2026-02", 0],
      ["2026-03", 0],
      ["2026-04", 0],
      ["2026-05", 0],
      ["2026-06", 0],
      ["2026-07", 0],
      ["2026-08", 0],
      ["2026-09", 0],
      ["2026-10", 0],
      ["2026-11", 0],
      ["2026-12", 1],
    ]);

    const taggedStats = buildLibraryStats(watchRows, tagRows, ratingRows, "Noir", "2026");
    expect(taggedStats.watchEventCount).toBe(1);
    expect(taggedStats.availableYearBuckets.map((bucket) => [bucket.key, bucket.count])).toEqual([
      ["2025", 1],
      ["2026", 1],
    ]);
  });

  it("returns empty collections when there are no watch events", () => {
    expect(buildLibraryStats([], [], [])).toMatchObject({
      availableYearBuckets: [],
      genreBreakdown: [],
      languageBreakdown: [],
      monthBuckets: [],
      movieCount: 0,
      movieRuntimeMinutes: 0,
      ratingBreakdown: [],
      runtimeMinutes: 0,
      showCount: 0,
      showRuntimeMinutes: 0,
      tagBreakdown: [],
      watchEventCount: 0,
      watchedCount: 0,
      yearBuckets: [],
    });
  });

  it("builds all-media stats from movie activity and watched show state", () => {
    const watchRows: MediaStatsWatchRow[] = [
      {
        id: "activity-1",
        media_id: "movie-a",
        episode_id: null,
        watched_at: "2026-01-10T12:00:00.000Z",
        media_items: {
          id: "movie-a",
          type: "movie",
          original_language: "ja",
          primary_genre_name: "Animation",
          runtime_minutes: 80,
          release_year: 2000,
        },
      },
      {
        id: "activity-2",
        media_id: "show-a",
        episode_id: "episode-a",
        watched_at: "2026-02-10T12:00:00.000Z",
        media_items: {
          id: "show-a",
          type: "show",
          original_language: "en",
          primary_genre_name: "Drama",
          runtime_minutes: 45,
          release_year: 2010,
        },
        episodes: { runtime_minutes: 42 },
      },
      {
        id: "activity-3",
        media_id: "show-a",
        episode_id: "episode-b",
        watched_at: "2026-03-10T12:00:00.000Z",
        media_items: {
          id: "show-a",
          type: "show",
          original_language: "en",
          primary_genre_name: "Drama",
          runtime_minutes: 45,
          release_year: 2010,
        },
        episodes: { runtime_minutes: 43 },
      },
    ];
    const tagRows: MediaStatsTagRow[] = [
      { media_id: "movie-a", tags: { id: "tag-1", name: "Weekend" } },
      { media_id: "show-a", tags: { id: "tag-1", name: "Weekend" } },
    ];
    const ratingRows: MediaStatsRatingRow[] = [
      { media_id: "movie-a", personal_rating: 8 },
      { media_id: "show-a", personal_rating: 10 },
    ];
    const stateRows: MediaStatsStateRow[] = [
      {
        media_id: "movie-a",
        status: "watched",
        personal_rating: 8,
        last_watched_at: "2026-01-10T12:00:00.000Z",
        completed_at: "2026-01-10T12:00:00.000Z",
        media_items: {
          id: "movie-a",
          type: "movie",
          original_language: "ja",
          primary_genre_name: "Animation",
          runtime_minutes: 80,
          release_year: 2000,
        },
      },
      {
        media_id: "show-a",
        status: "watched",
        personal_rating: 10,
        last_watched_at: "2026-03-10T12:00:00.000Z",
        completed_at: "2026-03-10T12:00:00.000Z",
        media_items: {
          id: "show-a",
          type: "show",
          original_language: "en",
          primary_genre_name: "Drama",
          runtime_minutes: 45,
          release_year: 2010,
        },
      },
    ];

    const stats = buildMediaLibraryStats(watchRows, tagRows, ratingRows, stateRows, "all");

    expect(stats.movieCount).toBe(1);
    expect(stats.showCount).toBe(1);
    expect(stats.episodeWatchCount).toBe(2);
    expect(stats.runtimeMinutes).toBe(165);
    expect(stats.movieRuntimeMinutes).toBe(80);
    expect(stats.showRuntimeMinutes).toBe(85);
    expect(stats.avgRating).toBe(9);
    expect(stats.genreBreakdown).toEqual([
      { count: 1, key: "animation", label: "Animation", percentage: 50 },
      { count: 1, key: "drama", label: "Drama", percentage: 50 },
    ]);
    expect(stats.tagBreakdown).toEqual([
      { count: 2, key: "tag-1", label: "Weekend", percentage: 100 },
    ]);

    const showWatchRows = watchRows.filter((row) => row.media_items?.type === "show");
    const showStats = buildMediaLibraryStats(
      showWatchRows,
      tagRows.filter((row) => row.media_id === "show-a"),
      ratingRows.filter((row) => row.media_id === "show-a"),
      stateRows.filter((row) => row.media_items?.type === "show"),
      "show",
      "Weekend",
      "2026",
    );
    expect(showStats.watchedCount).toBe(1);
    expect(showStats.showCount).toBe(1);
    expect(showStats.movieCount).toBe(0);
    expect(showStats.episodeWatchCount).toBe(2);
    expect(showStats.avgRuntimeMinutes).toBe(43);
    expect(showStats.monthBuckets).toHaveLength(12);
  });

  it("keeps show year filters available from watched show state without episode activity", () => {
    const stateRows: MediaStatsStateRow[] = [
      {
        media_id: "show-a",
        status: "watched",
        personal_rating: 9,
        last_watched_at: "2025-12-31T12:00:00.000Z",
        completed_at: "2025-12-31T12:00:00.000Z",
        media_items: {
          id: "show-a",
          type: "show",
          original_language: "en",
          primary_genre_name: "Drama",
          runtime_minutes: 45,
          release_year: 2010,
        },
      },
      {
        media_id: "show-b",
        status: "watched",
        personal_rating: 7,
        last_watched_at: "2026-01-05T12:00:00.000Z",
        completed_at: "2026-01-05T12:00:00.000Z",
        media_items: {
          id: "show-b",
          type: "show",
          original_language: "ko",
          primary_genre_name: "Mystery",
          runtime_minutes: 60,
          release_year: 2020,
        },
      },
    ];
    const ratingRows: MediaStatsRatingRow[] = [
      { media_id: "show-a", personal_rating: 9 },
      { media_id: "show-b", personal_rating: 7 },
    ];

    const stats = buildMediaLibraryStats([], [], ratingRows, stateRows, "show");

    expect(stats.availableYearBuckets.map((bucket) => [bucket.key, bucket.count])).toEqual([
      ["2025", 1],
      ["2026", 1],
    ]);

    const filteredStats = buildMediaLibraryStats([], [], ratingRows, stateRows, "show", undefined, "2025");
    expect(filteredStats.showCount).toBe(1);
    expect(filteredStats.watchedCount).toBe(1);
    expect(filteredStats.avgRating).toBe(9);
    expect(filteredStats.genreBreakdown).toEqual([
      { count: 1, key: "drama", label: "Drama", percentage: 100 },
    ]);
  });

  it("builds a lightweight watched-library summary without double-counting rewatches", () => {
    const watchRows: WatchedLibrarySummaryRow[] = [
      {
        movie_id: "movie-a",
        watched_at: "2025-12-20T12:00:00.000Z",
        movies: {
          original_language: "ja",
          primary_genre_name: "Animation",
        },
      },
      {
        movie_id: "movie-a",
        watched_at: "2026-01-10T12:00:00.000Z",
        movies: {
          original_language: "ja",
          primary_genre_name: "Animation",
        },
      },
      {
        movie_id: "movie-b",
        watched_at: "2026-03-10T12:00:00.000Z",
        movies: {
          original_language: null,
          primary_genre_name: null,
        },
      },
    ];

    const summary = buildWatchedLibrarySummary(watchRows);

    expect(summary.watchedCount).toBe(2);
    expect(summary.genreBreakdown).toEqual([
      { count: 1, key: "animation", label: "Animation", percentage: 50 },
      { count: 1, key: "unknown", label: "Unknown", percentage: 50 },
    ]);
    expect(summary.languageBreakdown).toEqual([
      { count: 1, key: "ja", label: "Japanese", percentage: 50 },
      { count: 1, key: "unknown", label: "Unknown", percentage: 50 },
    ]);
    expect(summary.monthBuckets.map((bucket) => [bucket.key, bucket.count])).toEqual([
      ["2025-12", 1],
      ["2026-01", 1],
      ["2026-02", 0],
      ["2026-03", 1],
    ]);
    expect(summary.yearBuckets.map((bucket) => [bucket.key, bucket.count])).toEqual([
      ["2025", 1],
      ["2026", 2],
    ]);
  });

  it("returns empty lightweight summary collections with no watch events", () => {
    expect(buildWatchedLibrarySummary([])).toEqual({
      watchedCount: 0,
      monthBuckets: [],
      yearBuckets: [],
      genreBreakdown: [],
      languageBreakdown: [],
    });
  });
});
