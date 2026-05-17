import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireUser: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { addMovieWatchDate, setMovieWatchStatus } from "@/lib/db/mutations/movies";

const movieId = "00000000-0000-4000-8000-000000000000";
const userId = "10000000-0000-4000-8000-000000000000";
const userMovie = {
  added_at: "2026-05-01T00:00:00.000Z",
  id: "20000000-0000-4000-8000-000000000000",
  last_watched_at: "2026-05-02T12:00:00.000Z",
  movie_id: movieId,
  personal_rating: null,
  status: "watched" as const,
  updated_at: "2026-05-02T12:00:00.000Z",
  user_id: userId,
  watchlisted_at: null,
};
const watchLog = {
  created_at: "2026-05-02T12:00:00.000Z",
  id: "30000000-0000-4000-8000-000000000000",
  movie_id: movieId,
  notes: null,
  provider_event_id: null,
  source: "manual" as const,
  user_id: userId,
  watched_at: "2026-05-02T12:00:00.000Z",
};

describe("movie watched-state mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: userId });
    mocks.createSupabaseServerClient.mockResolvedValue({
      rpc: mocks.rpc,
    });
    mocks.rpc.mockReturnValue({
      single: mocks.single,
    });
  });

  it("marks watched through one transactional RPC call", async () => {
    mocks.single.mockResolvedValue({
      data: {
        user_movie: userMovie,
        watch_log: watchLog,
      },
      error: null,
    });

    await expect(
      setMovieWatchStatus({
        movieId,
        source: "manual",
        status: "watched",
        watchedAt: watchLog.watched_at,
      }),
    ).resolves.toEqual({
      userMovie,
      watchLog,
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_movie_watch_state", {
      p_has_personal_rating: false,
      p_movie_id: movieId,
      p_notes: null,
      p_operation: "set_status",
      p_personal_rating: null,
      p_provider_event_id: null,
      p_source: "manual",
      p_status: "watched",
      p_watched_at: watchLog.watched_at,
    });
  });

  it("moves a movie to the watchlist through the same RPC path", async () => {
    mocks.single.mockResolvedValue({
      data: {
        user_movie: {
          ...userMovie,
          last_watched_at: null,
          status: "to_watch",
          watchlisted_at: "2026-05-03T12:00:00.000Z",
        },
        watch_log: null,
      },
      error: null,
    });

    await expect(
      setMovieWatchStatus({
        movieId,
        personalRating: null,
        status: "to_watch",
      }),
    ).resolves.toMatchObject({
      watchLog: null,
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_movie_watch_state", {
      p_has_personal_rating: true,
      p_movie_id: movieId,
      p_notes: null,
      p_operation: "set_status",
      p_personal_rating: null,
      p_provider_event_id: null,
      p_source: "manual",
      p_status: "to_watch",
      p_watched_at: null,
    });
  });

  it("logs repeat watches through one RPC call and preserves inbound sync source", async () => {
    mocks.single.mockResolvedValue({
      data: {
        user_movie: userMovie,
        watch_log: {
          ...watchLog,
          provider_event_id: "trakt-1",
          source: "trakt_sync",
        },
      },
      error: null,
    });

    await expect(
      addMovieWatchDate(movieId, {
        providerEventId: "trakt-1",
        source: "trakt_sync",
        watchedAt: watchLog.watched_at,
      }),
    ).resolves.toMatchObject({
      watchLog: {
        provider_event_id: "trakt-1",
        source: "trakt_sync",
      },
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_movie_watch_state", {
      p_has_personal_rating: false,
      p_movie_id: movieId,
      p_notes: null,
      p_operation: "add_watch_date",
      p_personal_rating: null,
      p_provider_event_id: "trakt-1",
      p_source: "trakt_sync",
      p_status: "watched",
      p_watched_at: watchLog.watched_at,
    });
  });
});
