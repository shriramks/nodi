import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchTraktJsonPage,
  listTraktListMovieItemsPage,
  listTraktUserListsPage,
} from "@/lib/providers/trakt/client";

describe("Trakt client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed pagination headers with page items", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: 1 }]), {
        headers: {
          "content-type": "application/json",
          "x-pagination-item-count": "250",
          "x-pagination-limit": "100",
          "x-pagination-page": "2",
          "x-pagination-page-count": "3",
        },
        status: 200,
      }),
    );

    const result = await fetchTraktJsonPage<Array<{ id: number }>>("/users/me/history/movies", {
      accessToken: "access-token",
      clientId: "client-id",
      query: {
        limit: 100,
        page: 2,
      },
    });

    expect(result).toEqual({
      items: [{ id: 1 }],
      pagination: {
        itemCount: 250,
        limit: 100,
        page: 2,
        pageCount: 3,
      },
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.trakt.tv/users/me/history/movies?limit=100&page=2",
    );
  });

  it("treats missing or invalid pagination headers as unknown", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: {
          "content-type": "application/json",
          "x-pagination-limit": "0",
          "x-pagination-page": "nope",
        },
        status: 200,
      }),
    );

    await expect(
      fetchTraktJsonPage<unknown[]>("/users/me/ratings/movies", {
        clientId: "client-id",
      }),
    ).resolves.toMatchObject({
      pagination: {
        itemCount: null,
        limit: null,
        page: null,
        pageCount: null,
      },
    });
  });

  it("builds user list page requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ ids: { slug: "favorites", trakt: 123 }, name: "Favorites" }]), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    const result = await listTraktUserListsPage(
      { accessToken: "access-token", clientId: "client-id" },
      { limit: 100, page: 2 },
    );

    expect(result.items).toEqual([
      { ids: { slug: "favorites", trakt: 123 }, name: "Favorites" },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.trakt.tv/users/me/lists?page=2&limit=100",
    );
  });

  it("builds user list movie item page requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ movie: { ids: { tmdb: 437 } }, type: "movie" }]), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    const result = await listTraktListMovieItemsPage(
      { accessToken: "access-token", clientId: "client-id" },
      { limit: 100, listId: "festival picks", page: 1 },
    );

    expect(result.items).toEqual([{ movie: { ids: { tmdb: 437 } }, type: "movie" }]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.trakt.tv/users/me/lists/festival%20picks/items/movies?page=1&limit=100",
    );
  });
});
