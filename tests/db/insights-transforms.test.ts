import { describe, expect, it } from "vitest";

import { buildCompanionMonth, buildInsights } from "@/lib/db/queries/insights-transforms";
import type {
  MediaStatsRatingRow,
  MediaStatsTagRow,
  MediaStatsWatchRow,
} from "@/lib/db/queries/stats-transforms";

const now = new Date("2026-10-02T12:00:00.000Z");

function watch(
  id: string,
  mediaId: string,
  watchedAt: string,
  options: {
    type?: "movie" | "show";
    runtime?: number;
    title?: string;
    releaseYear?: number | null;
    episodeId?: string;
    episodeRuntime?: number;
  } = {},
): MediaStatsWatchRow {
  return {
    id,
    media_id: mediaId,
    episode_id: options.episodeId ?? null,
    watched_at: watchedAt,
    media_items: {
      id: mediaId,
      type: options.type ?? "movie",
      title: options.title ?? mediaId,
      runtime_minutes: options.runtime ?? 100,
      original_language: null,
      primary_genre_name: null,
      release_year: options.releaseYear === undefined ? 2015 : options.releaseYear,
    },
    episodes: options.episodeRuntime ? { runtime_minutes: options.episodeRuntime } : null,
  };
}

const amele = (mediaId: string): MediaStatsTagRow => ({
  media_id: mediaId,
  tags: { id: "tag-amele", name: "Amele" },
});

const rating = (mediaId: string, value: number): MediaStatsRatingRow => ({
  media_id: mediaId,
  personal_rating: value,
});

describe("buildInsights", () => {
  it("splits this year into with and without the companion, counting titles not episodes", () => {
    const insights = buildInsights({
      seasonEpisodes: [
        { id: "e1", show_id: "show-a", season_number: 1 },
        { id: "e2", show_id: "show-a", season_number: 1 },
      ],
      watchRows: [
        watch("1", "movie-a", "2026-03-01T20:00:00Z", { runtime: 120 }),
        watch("2", "movie-b", "2026-04-01T20:00:00Z", { runtime: 90 }),
        watch("3", "show-a", "2026-05-01T20:00:00Z", { type: "show", episodeId: "e1", episodeRuntime: 40 }),
        watch("4", "show-a", "2026-05-02T20:00:00Z", { type: "show", episodeId: "e2", episodeRuntime: 40 }),
        watch("5", "movie-old", "2025-12-01T20:00:00Z"),
      ],
      tagRows: [amele("show-a"), amele("movie-old")],
      ratingRows: [],
      companionTag: "amele",
      now,
    });

    expect(insights.thisYear.withCompanion).toEqual({ titleCount: 1, runtimeMinutes: 80 });
    expect(insights.thisYear.withoutCompanion).toEqual({ titleCount: 2, runtimeMinutes: 210 });
  });

  it("counts a completed season as one title and ignores partial seasons", () => {
    const insights = buildInsights({
      watchRows: [
        watch("1", "show-a", "2026-05-01T20:00:00Z", { type: "show", episodeId: "a1", episodeRuntime: 40 }),
        watch("2", "show-a", "2026-05-02T20:00:00Z", { type: "show", episodeId: "a2", episodeRuntime: 40 }),
        watch("3", "show-a", "2026-06-01T20:00:00Z", { type: "show", episodeId: "a3", episodeRuntime: 40 }),
        watch("4", "show-b", "2026-05-03T20:00:00Z", { type: "show", episodeId: "b1", episodeRuntime: 30 }),
      ],
      seasonEpisodes: [
        { id: "a1", show_id: "show-a", season_number: 1 },
        { id: "a2", show_id: "show-a", season_number: 1 },
        { id: "a3", show_id: "show-a", season_number: 2 },
        { id: "a4", show_id: "show-a", season_number: 2 },
        { id: "b1", show_id: "show-b", season_number: 1 },
        { id: "b2", show_id: "show-b", season_number: 1 },
      ],
      tagRows: [amele("show-a"), amele("show-b")],
      ratingRows: [],
      companionTag: "amele",
      now,
    });

    // Season 1 of show-a is complete; season 2 and show-b season 1 are partial.
    expect(insights.thisYear.withCompanion).toEqual({ titleCount: 1, runtimeMinutes: 150 });
  });

  it("matches the companion tag case-insensitively and ignores other tags", () => {
    const insights = buildInsights({
      seasonEpisodes: [],
      watchRows: [watch("1", "movie-a", "2026-03-01T20:00:00Z")],
      tagRows: [{ media_id: "movie-a", tags: { id: "t", name: " AMELE " } }],
      ratingRows: [],
      companionTag: "Amele",
      now,
    });
    expect(insights.hasCompanionData).toBe(true);

    const none = buildInsights({
      seasonEpisodes: [],
      watchRows: [watch("1", "movie-a", "2026-03-01T20:00:00Z")],
      tagRows: [{ media_id: "movie-a", tags: { id: "t", name: "Noir" } }],
      ratingRows: [],
      companionTag: "amele",
      now,
    });
    expect(none.hasCompanionData).toBe(false);
  });

  it("compares against the same span of last year", () => {
    const insights = buildInsights({
      seasonEpisodes: [],
      watchRows: [
        watch("1", "movie-a", "2026-01-15T20:00:00Z", { runtime: 100 }),
        watch("2", "movie-b", "2025-02-15T20:00:00Z", { runtime: 110 }),
        watch("3", "movie-c", "2025-10-02T20:00:00Z", { runtime: 120 }),
        watch("4", "movie-d", "2025-10-03T20:00:00Z", { runtime: 500 }),
      ],
      tagRows: [amele("movie-a"), amele("movie-b"), amele("movie-c"), amele("movie-d")],
      ratingRows: [],
      companionTag: "amele",
      now,
    });

    expect(insights.thisYear.withCompanion).toEqual({ titleCount: 1, runtimeMinutes: 100 });
    expect(insights.thisYear.withCompanionLastYear).toEqual({ titleCount: 2, runtimeMinutes: 230 });
  });

  it("picks highest and lowest rated, preferring the most recent on ties", () => {
    const insights = buildInsights({
      seasonEpisodes: [],
      watchRows: [
        watch("1", "a", "2026-01-01T20:00:00Z", { title: "Alpha" }),
        watch("2", "b", "2026-02-01T20:00:00Z", { title: "Beta" }),
        watch("3", "c", "2026-03-01T20:00:00Z", { title: "Gamma" }),
        watch("4", "d", "2026-04-01T20:00:00Z", { title: "Delta" }),
        watch("5", "e", "2025-04-01T20:00:00Z", { title: "Last year" }),
      ],
      tagRows: ["a", "b", "c", "d", "e"].map(amele),
      ratingRows: [rating("a", 9), rating("b", 9), rating("c", 4), rating("d", 4), rating("e", 8)],
      companionTag: "amele",
      now,
    });

    expect(insights.thisYear.highestRated).toMatchObject({ title: "Beta", rating: 9 });
    expect(insights.thisYear.lowestRated).toMatchObject({ title: "Delta", rating: 4 });
    expect(insights.thisYear.avgRating).toBe(7);
    expect(insights.thisYear.avgRatingLastYear).toBe(8);
  });

  it("hides the lowest-rated title when it is the only rated one", () => {
    const insights = buildInsights({
      seasonEpisodes: [],
      watchRows: [watch("1", "a", "2026-01-01T20:00:00Z", { title: "Alpha" })],
      tagRows: [amele("a")],
      ratingRows: [rating("a", 7)],
      companionTag: "amele",
      now,
    });

    expect(insights.thisYear.highestRated?.title).toBe("Alpha");
    expect(insights.thisYear.lowestRated).toBeNull();
  });

  it("returns empty ratings when nothing watched with the companion is rated", () => {
    const insights = buildInsights({
      seasonEpisodes: [],
      watchRows: [watch("1", "a", "2026-01-01T20:00:00Z")],
      tagRows: [amele("a")],
      ratingRows: [],
      companionTag: "amele",
      now,
    });

    expect(insights.thisYear.highestRated).toBeNull();
    expect(insights.thisYear.lowestRated).toBeNull();
    expect(insights.thisYear.avgRating).toBeNull();
  });

  it("derives habits from companion titles only", () => {
    const insights = buildInsights({
      seasonEpisodes: [],
      watchRows: [
        // 2023-10-01 is a Sunday.
        watch("1", "a", "2023-10-01T20:00:00Z", { releaseYear: 2012 }),
        watch("2", "b", "2024-02-11T20:00:00Z", { releaseYear: 2018 }),
        watch("3", "c", "2024-02-04T20:00:00Z", { releaseYear: 1999 }),
        watch("4", "solo", "2024-03-06T20:00:00Z", { releaseYear: 1980 }),
        watch("5", "show", "2024-02-05T10:00:00Z", { type: "show", episodeId: "e1" }),
        watch("6", "show", "2024-02-05T11:00:00Z", { type: "show", episodeId: "e2" }),
      ],
      tagRows: [amele("a"), amele("b"), amele("c"), amele("show")],
      ratingRows: [],
      companionTag: "amele",
      now,
    });

    expect(insights.habits.busiestMonth).toEqual({ key: "2024-02", label: "Feb 2024", runtimeMinutes: 400 });
    expect(insights.habits.quietestMonth).toEqual({ key: "2023-10", label: "Oct 2023", runtimeMinutes: 100 });
    expect(insights.habits.topWeekday).toBe("Sunday");
    expect(insights.habits.topDecade).toBe("2010s");
  });

  it("hides the quietest month when it is the busiest month", () => {
    const insights = buildInsights({
      seasonEpisodes: [],
      watchRows: [watch("1", "a", "2024-02-04T20:00:00Z")],
      tagRows: [amele("a")],
      ratingRows: [],
      companionTag: "amele",
      now,
    });

    expect(insights.habits.busiestMonth?.key).toBe("2024-02");
    expect(insights.habits.quietestMonth).toBeNull();
  });
});

describe("buildCompanionMonth", () => {
  it("compares the previous calendar month with the one before it", () => {
    const month = buildCompanionMonth({
      seasonEpisodes: [],
      watchRows: [
        watch("1", "movie-a", "2026-09-05T20:00:00Z", { runtime: 100 }),
        watch("2", "movie-b", "2026-09-12T20:00:00Z", { runtime: 120 }),
        watch("3", "movie-other", "2026-09-20T20:00:00Z", { runtime: 100 }),
        watch("4", "movie-c", "2026-08-31T20:00:00Z", { runtime: 90 }),
        watch("5", "movie-d", "2026-10-01T20:00:00Z", { runtime: 500 }),
      ],
      tagRows: [amele("movie-a"), amele("movie-b"), amele("movie-c"), amele("movie-d")],
      ratingRows: [rating("movie-a", 3), rating("movie-b", 4.5)],
      companionTag: "amele",
      now,
    });

    expect(month.label).toBe("September");
    expect(month.previousMonthLabel).toBe("August");
    expect(month.withCompanion).toEqual({ titleCount: 2, runtimeMinutes: 220 });
    expect(month.withCompanionPreviousMonth).toEqual({ titleCount: 1, runtimeMinutes: 90 });
    expect(month.sharePercent).toBe(68.8);
    expect(month.highestRated?.title).toBe("movie-b");
  });

  it("rolls over the year boundary in January", () => {
    const month = buildCompanionMonth({
      seasonEpisodes: [],
      watchRows: [watch("1", "movie-a", "2025-12-10T20:00:00Z")],
      tagRows: [amele("movie-a")],
      ratingRows: [],
      companionTag: "amele",
      now: new Date("2026-01-05T12:00:00Z"),
    });

    expect(month.label).toBe("December");
    expect(month.previousMonthLabel).toBe("November");
    expect(month.withCompanion.titleCount).toBe(1);
  });

  it("returns empty totals when nothing was watched together", () => {
    const month = buildCompanionMonth({
      seasonEpisodes: [],
      watchRows: [watch("1", "movie-a", "2026-09-05T20:00:00Z")],
      tagRows: [],
      ratingRows: [],
      companionTag: "amele",
      now,
    });

    expect(month.withCompanion.titleCount).toBe(0);
    expect(month.topWeekday).toBeNull();
    expect(month.highestRated).toBeNull();
  });
});
