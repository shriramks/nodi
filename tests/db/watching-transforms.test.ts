import { describe, expect, it } from "vitest";

import { buildWatchingShows } from "@/lib/db/queries/watching-transforms";

const show = (id: string, lastWatchedAt: string | null) => ({
  media_id: id,
  last_watched_at: lastWatchedAt,
  media_items: { id, title: id, poster_path: null, backdrop_path: null },
});

const episode = (id: string, showId: string, season: number, number: number, airDate: string | null) => ({
  id,
  show_id: showId,
  season_number: season,
  episode_number: number,
  title: id,
  air_date: airDate,
});

describe("buildWatchingShows", () => {
  it("picks the first unwatched aired episode and counts progress", () => {
    const [result] = buildWatchingShows({
      showRows: [show("a", "2026-09-30T00:00:00Z")],
      episodeRows: [
        episode("e3", "a", 1, 3, "2026-01-03"),
        episode("e1", "a", 1, 1, "2026-01-01"),
        episode("e2", "a", 1, 2, "2026-01-02"),
      ],
      watchedEpisodeIds: new Set(["e1"]),
      today: "2026-10-02",
    });

    expect(result.nextEpisode?.id).toBe("e2");
    expect(result.watchedEpisodeCount).toBe(1);
    expect(result.totalEpisodeCount).toBe(3);
  });

  it("ignores specials for the next episode and progress", () => {
    const [result] = buildWatchingShows({
      showRows: [show("a", null)],
      episodeRows: [episode("sp1", "a", 0, 1, "2026-01-01"), episode("e1", "a", 1, 1, "2026-01-02")],
      watchedEpisodeIds: new Set(),
      today: "2026-10-02",
    });

    expect(result.nextEpisode?.id).toBe("e1");
    expect(result.totalEpisodeCount).toBe(1);
  });

  it("never picks an unaired episode as next", () => {
    const [result] = buildWatchingShows({
      showRows: [show("a", null)],
      episodeRows: [episode("e1", "a", 1, 1, "2026-01-01"), episode("e2", "a", 1, 2, "2026-12-01")],
      watchedEpisodeIds: new Set(["e1"]),
      today: "2026-10-02",
    });

    expect(result.nextEpisode).toBeNull();
  });

  it("orders shows by most recent watch, never-watched last", () => {
    const result = buildWatchingShows({
      showRows: [show("old", "2026-01-01T00:00:00Z"), show("none", null), show("new", "2026-09-01T00:00:00Z")],
      episodeRows: [],
      watchedEpisodeIds: new Set(),
      today: "2026-10-02",
    });

    expect(result.map((item) => item.id)).toEqual(["new", "old", "none"]);
  });
});
