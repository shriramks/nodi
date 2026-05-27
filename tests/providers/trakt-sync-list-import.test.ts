import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  createSyncEvent: vi.fn(),
  listPendingSyncEvents: vi.fn(),
  listTraktListMovieItemsPage: vi.fn(),
  listTraktListShowItemsPage: vi.fn(),
  listTraktUserListsPage: vi.fn(),
  requireUser: vi.fn(),
  updateSyncEventStatus: vi.fn(),
  upsertSyncCursor: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/db/mutations", () => ({
  createSyncEvent: mocks.createSyncEvent,
  updateSyncEventStatus: mocks.updateSyncEventStatus,
  upsertSyncCursor: mocks.upsertSyncCursor,
}));

vi.mock("@/lib/db/queries", () => ({
  listPendingSyncEvents: mocks.listPendingSyncEvents,
}));

vi.mock("@/lib/providers/trakt/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/providers/trakt/client")>(
    "@/lib/providers/trakt/client",
  );

  return {
    ...actual,
    listTraktListMovieItemsPage: mocks.listTraktListMovieItemsPage,
    listTraktListShowItemsPage: mocks.listTraktListShowItemsPage,
    listTraktUserListsPage: mocks.listTraktUserListsPage,
  };
});

vi.mock("@/lib/providers/trakt/credentials", () => ({
  loadTraktSyncCredentials: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import { __traktSyncTestHooks } from "@/lib/providers/trakt/sync";
import {
  listMetadataCursorKey,
  snapshotCursorKey,
} from "@/lib/providers/trakt/sync-cursors";

const userId = "10000000-0000-4000-8000-000000000000";
const run = { runId: "sync-run-1", userId };
const auth = { accessToken: "access-token", clientId: "client-id" };
const showId = "20000000-0000-4000-8000-000000000000";
const tagId = "30000000-0000-4000-8000-000000000000";

function createQuery(result: unknown) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    then: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  };

  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.upsert.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  query.single.mockResolvedValue(result);
  query.then.mockImplementation((resolve, reject) =>
    Promise.resolve(result).then(resolve, reject),
  );

  return query;
}

function createSupabaseWithQueues(
  queriesByTable: Record<string, ReturnType<typeof createQuery>[]>,
) {
  const from = vi.fn((table: string) => {
    if (table === "sync_runs") {
      return createQuery({ data: { status: "running" }, error: null });
    }

    const query = queriesByTable[table]?.shift();

    if (!query) {
      throw new Error(`Unexpected table query: ${table}`);
    }

    return query;
  });

  mocks.createSupabaseAdminClient.mockReturnValue({ from });

  return { from };
}

describe("Trakt sync list imports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps fetched movie list items when show item fetch fails without advancing list cursors", async () => {
    const result = __traktSyncTestHooks.createPullResult();
    const list = {
      ids: { slug: "favorites", trakt: 123 },
      item_count: 2,
      name: "Favorites",
      updated_at: "2026-05-27T00:00:00.000Z",
    };

    createSupabaseWithQueues({});
    mocks.listTraktUserListsPage.mockResolvedValue({
      items: [list],
      pagination: { itemCount: 1, limit: 100, page: 1, pageCount: 1 },
    });
    mocks.listTraktListMovieItemsPage.mockResolvedValue({
      items: [{
        movie: { ids: { tmdb: 437 }, title: "Perfect Blue", year: 1997 },
        type: "movie",
      }],
      pagination: { itemCount: 1, limit: 100, page: 1, pageCount: 1 },
    });
    mocks.listTraktListShowItemsPage.mockRejectedValue(new Error("Trakt show fetch failed"));

    const fetch = await __traktSyncTestHooks.listAllListsWithTaggableItems(
      auth,
      new Map(),
      result,
      run,
    );
    const listStates = __traktSyncTestHooks.normalizeListStates(
      fetch.imports,
      new Map(),
      result,
    );

    await __traktSyncTestHooks.storeListSnapshots(listStates, run);

    expect(fetch.imports).toHaveLength(1);
    expect(fetch.imports[0]).toMatchObject({
      cursorKey: "123",
      itemFetchComplete: false,
      movieItems: [{
        movie: { ids: { tmdb: 437 }, title: "Perfect Blue", year: 1997 },
        type: "movie",
      }],
      showItems: [],
    });
    expect(result.failureSamples).toEqual([
      "list:123:shows: Trakt show fetch failed",
    ]);
    expect(mocks.upsertSyncCursor).not.toHaveBeenCalledWith(
      "trakt",
      snapshotCursorKey("lists.123"),
      expect.any(String),
    );
    expect(mocks.upsertSyncCursor).not.toHaveBeenCalledWith(
      "trakt",
      listMetadataCursorKey("123"),
      expect.any(String),
    );
  });

  it("fetches only show list items with TV-only list cursors", async () => {
    const result = __traktSyncTestHooks.createPullResult();
    const list = {
      ids: { slug: "favorites", trakt: 123 },
      item_count: 2,
      name: "Favorites",
      updated_at: "2026-05-27T00:00:00.000Z",
    };

    createSupabaseWithQueues({});
    mocks.listTraktUserListsPage.mockResolvedValue({
      items: [list],
      pagination: { itemCount: 1, limit: 100, page: 1, pageCount: 1 },
    });
    mocks.listTraktListShowItemsPage.mockResolvedValue({
      items: [{
        show: { ids: { tmdb: 1396, trakt: 456 }, title: "Breaking Bad", year: 2008 },
        type: "show",
      }],
      pagination: { itemCount: 1, limit: 100, page: 1, pageCount: 1 },
    });

    const fetch = await __traktSyncTestHooks.listAllListsWithTaggableItems(
      auth,
      new Map([
        [snapshotCursorKey("lists.123"), "[\"movie:tmdb:437\"]"],
        [listMetadataCursorKey("123"), "{\"itemKinds\":[\"movie\",\"show\"]}"],
      ]),
      result,
      run,
      { itemKinds: ["show"] },
    );
    const listStates = __traktSyncTestHooks.normalizeListStates(
      fetch.imports,
      new Map(),
      result,
    );

    await __traktSyncTestHooks.storeListSnapshots(listStates, run);

    expect(mocks.listTraktListMovieItemsPage).not.toHaveBeenCalled();
    expect(mocks.listTraktListShowItemsPage).toHaveBeenCalledWith(auth, {
      limit: 100,
      listId: "123",
      page: 1,
    });
    expect(fetch.imports[0]).toMatchObject({
      cursorKey: "123.shows",
      movieItems: [],
      showItems: [{
        show: { ids: { tmdb: 1396, trakt: 456 }, title: "Breaking Bad", year: 2008 },
        type: "show",
      }],
    });
    expect(mocks.upsertSyncCursor).toHaveBeenCalledWith(
      "trakt",
      snapshotCursorKey("lists.123.shows"),
      "[\"show:trakt:456\"]",
    );
    expect(mocks.upsertSyncCursor).not.toHaveBeenCalledWith(
      "trakt",
      snapshotCursorKey("lists.123"),
      expect.any(String),
    );
  });

  it("resolves Trakt show list items to local shows and upserts user media tags", async () => {
    const result = __traktSyncTestHooks.createPullResult();
    const userMediaTagsUpsert = createQuery({ data: null, error: null });
    const existingTagSelect = createQuery({
      data: [{
        created_at: "2026-05-27T00:00:00.000Z",
        id: tagId,
        name: "TV Favorites",
        normalized_name: "tv favorites",
        user_id: userId,
      }],
      error: null,
    });

    createSupabaseWithQueues({
      media_items: [createQuery({
        data: [{
          first_air_date: "2008-01-20",
          id: showId,
          title: "Breaking Bad",
          type: "show",
        }],
        error: null,
      })],
      media_provider_mappings: [
        createQuery({ data: [], error: null }),
        createQuery({
          data: [{
            created_at: "2026-05-27T00:00:00.000Z",
            episode_id: null,
            media_id: showId,
            provider: "tmdb",
            provider_id: "1396",
            provider_media_type: "show",
          }],
          error: null,
        }),
      ],
      tags: [existingTagSelect],
      user_media_tags: [userMediaTagsUpsert],
    });

    const listStates = __traktSyncTestHooks.normalizeListStates(
      [{
        cursorKey: "tv-favorites",
        itemFetchComplete: true,
        itemFetchSkipped: false,
        listKey: "tv-favorites",
        metadataCursor: "{}",
        movieItems: [],
        previousMetadataCursor: undefined,
        previousSnapshot: undefined,
        showItems: [{
          show: {
            ids: { tmdb: 1396, trakt: 456 },
            title: "Breaking Bad",
            year: 2008,
          },
          type: "show",
        }],
        tagName: "TV Favorites",
      }],
      new Map(),
      result,
    );
    const showResolution = await __traktSyncTestHooks.resolveRemoteShows({
      remoteKeys: [],
      remoteShows: listStates.flatMap((listState) => listState.showStatesToTag),
      result,
      run,
    });
    const tagsByListKey = await __traktSyncTestHooks.upsertTraktListTags(
      userId,
      listStates,
      result,
      run,
    );

    await __traktSyncTestHooks.upsertTraktListMediaTags(
      userId,
      listStates,
      tagsByListKey,
      showResolution,
      result,
      run,
    );

    expect(showResolution.mediaIdByRemoteKey.get("trakt:456")).toBe(showId);
    expect(userMediaTagsUpsert.upsert).toHaveBeenCalledWith(
      [{
        media_id: showId,
        tag_id: tagId,
        user_id: userId,
      }],
      { onConflict: "user_id,media_id,tag_id" },
    );
    expect(result.listItemsTagged).toBe(1);
  });
});
