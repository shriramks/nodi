import { describe, expect, it } from "vitest";

import {
  buildUserMovieStatusPayload,
  latestTimestamp,
  shouldQueueOutboundSync,
} from "@/lib/db/mutations/movie-state";

const movieId = "00000000-0000-4000-8000-000000000000";
const userId = "10000000-0000-4000-8000-000000000000";
const now = "2026-05-09T00:00:00.000Z";

describe("movie mutation state helpers", () => {
  it("builds watched user_movie payloads without clobbering omitted ratings", () => {
    expect(
      buildUserMovieStatusPayload({
        action: {
          movieId,
          source: "manual",
          status: "watched",
          watchedAt: "2026-05-01T12:00:00.000Z",
        },
        now,
        userId,
      }),
    ).toEqual({
      last_watched_at: "2026-05-01T12:00:00.000Z",
      movie_id: movieId,
      status: "watched",
      user_id: userId,
      watchlisted_at: null,
    });
  });

  it("builds watchlist payloads and clears existing watched state", () => {
    expect(
      buildUserMovieStatusPayload({
        action: {
          movieId,
          personalRating: null,
          source: "manual",
          status: "to_watch",
          watchedAt: null,
        },
        now,
        userId,
      }),
    ).toEqual({
      last_watched_at: null,
      movie_id: movieId,
      personal_rating: null,
      status: "to_watch",
      user_id: userId,
      watchlisted_at: now,
    });
  });

  it("does not queue outbound sync for inbound Trakt sync writes", () => {
    expect(shouldQueueOutboundSync("trakt_sync")).toBe(false);
    expect(shouldQueueOutboundSync("manual")).toBe(true);
    expect(shouldQueueOutboundSync(null)).toBe(true);
  });

  it("keeps the latest watched timestamp", () => {
    expect(
      latestTimestamp("2026-05-02T00:00:00.000Z", "2026-05-01T00:00:00.000Z"),
    ).toBe("2026-05-02T00:00:00.000Z");
    expect(latestTimestamp(null, "2026-05-01T00:00:00.000Z")).toBe(
      "2026-05-01T00:00:00.000Z",
    );
  });
});
