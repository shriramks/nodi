import { describe, expect, it } from "vitest";

import {
  buildMovieWatchStateMutationArgs,
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

  it("builds watched-state mutation args for a watched write", () => {
    expect(
      buildMovieWatchStateMutationArgs({
        action: {
          movieId,
          source: "manual",
          status: "watched",
          watchedAt: "2026-05-01T12:00:00.000Z",
        },
        operation: "set_status",
      }),
    ).toEqual({
      p_has_personal_rating: false,
      p_movie_id: movieId,
      p_notes: null,
      p_operation: "set_status",
      p_personal_rating: null,
      p_provider_event_id: null,
      p_source: "manual",
      p_status: "watched",
      p_watched_at: "2026-05-01T12:00:00.000Z",
    });
  });

  it("preserves explicit rating clears on watchlist writes", () => {
    expect(
      buildMovieWatchStateMutationArgs({
        action: {
          movieId,
          personalRating: null,
          status: "to_watch",
        },
        operation: "set_status",
      }),
    ).toMatchObject({
      p_has_personal_rating: true,
      p_personal_rating: null,
      p_status: "to_watch",
      p_watched_at: null,
    });
  });

  it("builds repeat-watch mutation args separately from first watched writes", () => {
    expect(
      buildMovieWatchStateMutationArgs({
        action: {
          movieId,
          providerEventId: "trakt-1",
          source: "trakt_sync",
          status: "watched",
          watchedAt: "2026-05-02T12:00:00.000Z",
        },
        operation: "add_watch_date",
      }),
    ).toMatchObject({
      p_operation: "add_watch_date",
      p_provider_event_id: "trakt-1",
      p_source: "trakt_sync",
    });
  });
});
