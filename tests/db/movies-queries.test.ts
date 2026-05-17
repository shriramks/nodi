import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { listLibraryMoviesPage, listUserMovies } from "@/lib/db/queries/movies";

const userId = "10000000-0000-4000-8000-000000000000";

describe("movie queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: userId });
  });

  it("loads list movies without hydrating movie tags", async () => {
    const userMoviesQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      range: vi.fn(),
      order: vi.fn(),
    };
    userMoviesQuery.select.mockReturnValue(userMoviesQuery);
    userMoviesQuery.eq.mockReturnValue(userMoviesQuery);
    userMoviesQuery.range.mockReturnValue(userMoviesQuery);
    userMoviesQuery.order.mockResolvedValue({
      data: [
        {
          added_at: "2026-05-01T00:00:00.000Z",
          id: "20000000-0000-4000-8000-000000000000",
          last_watched_at: "2026-05-02T00:00:00.000Z",
          movie_id: "30000000-0000-4000-8000-000000000000",
          movies: {
            id: "30000000-0000-4000-8000-000000000000",
            title: "Nodi",
          },
          personal_rating: null,
          status: "watched",
          updated_at: "2026-05-02T00:00:00.000Z",
          user_id: userId,
          watchlisted_at: null,
        },
      ],
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table !== "user_movies") {
        throw new Error(`Unexpected table query: ${table}`);
      }

      return userMoviesQuery;
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    await expect(listUserMovies({ status: "watched" })).resolves.toEqual([
      expect.objectContaining({
        movie: expect.objectContaining({ title: "Nodi" }),
      }),
    ]);

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("user_movies");
  });

  it("loads paged library rows through the database filter RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          added_at: "2026-05-01T00:00:00.000Z",
          id: "20000000-0000-4000-8000-000000000000",
          last_watched_at: "2026-05-02T00:00:00.000Z",
          movie: {
            id: "30000000-0000-4000-8000-000000000000",
            poster_path: "/poster.jpg",
            title: "Nodi",
          },
          movie_id: "30000000-0000-4000-8000-000000000000",
          personal_rating: 8,
          status: "watched",
          total_count: 2,
          updated_at: "2026-05-02T00:00:00.000Z",
          user_id: userId,
          watchlisted_at: null,
        },
      ],
      error: null,
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc });

    await expect(
      listLibraryMoviesPage({
        status: "watched",
        filters: {
          tagNames: [" Noir ", "noir"],
          watchedMonth: "2026-05",
          watchedYear: "2025",
        },
      }),
    ).resolves.toEqual({
      movies: [
        expect.objectContaining({
          movie: expect.objectContaining({ title: "Nodi" }),
        }),
      ],
      totalCount: 2,
      hasMore: true,
      nextOffset: 1,
    });

    expect(rpc).toHaveBeenCalledWith("list_library_movies_page", {
      p_status: "watched",
      p_limit: 48,
      p_offset: 0,
      p_sort_key: "watched_date",
      p_sort_direction: "desc",
      p_genre: null,
      p_language: null,
      p_tag_names: ["Noir", "noir"],
      p_rating_op: null,
      p_rating_value: null,
      p_watched_start: "2026-05-01T00:00:00.000Z",
      p_watched_end: "2026-06-01T00:00:00.000Z",
    });
  });
});
