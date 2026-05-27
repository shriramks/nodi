import { describe, expect, it } from "vitest";

import {
  canSkipListItemFetch,
  getStringSnapshotDelta,
  latestTimestamp,
  listMetadataCursorKey,
  parseRatingSnapshot,
  parseStringArrayCursor,
  pullPhaseCheckpointCursorKey,
  serializeListMetadataCursor,
  serializeRatingSnapshot,
  serializeStringSnapshot,
  snapshotCursorKey,
} from "@/lib/providers/trakt/sync-cursors";

describe("Trakt sync cursors", () => {
  it("uses stable snapshot cursor names for current and future scopes", () => {
    expect(snapshotCursorKey("watchlist")).toBe("watchlist.snapshot");
    expect(snapshotCursorKey("ratings")).toBe("ratings.snapshot");
    expect(snapshotCursorKey("lists.favorites")).toBe("lists.favorites.snapshot");
    expect(listMetadataCursorKey("favorites")).toBe("lists.favorites.metadata");
    expect(pullPhaseCheckpointCursorKey("history")).toBe("pull.history.completed_at");
    expect(pullPhaseCheckpointCursorKey("lists")).toBe("pull.lists.completed_at");
  });

  it("serializes list metadata cursors in a stable normalized shape", () => {
    expect(
      serializeListMetadataCursor({
        itemKinds: ["show", "movie", "movie"],
        itemCount: 3,
        tagName: " Favorites ",
        updatedAt: " 2026-05-10T08:00:00.000Z ",
      }),
    ).toBe(
      "{\"itemKinds\":[\"movie\",\"show\"],\"itemCount\":3,\"tagName\":\"Favorites\",\"updatedAt\":\"2026-05-10T08:00:00.000Z\"}",
    );

    expect(
      serializeListMetadataCursor({
        itemCount: -1,
        tagName: "",
        updatedAt: null,
      }),
    ).toBe("{\"itemKinds\":[],\"itemCount\":null,\"tagName\":null,\"updatedAt\":null}");
  });

  it("uses list metadata cursors only when the item snapshot can be reused", () => {
    const metadataCursor = serializeListMetadataCursor({
      itemKinds: ["movie", "show"],
      itemCount: 2,
      tagName: "Favorites",
      updatedAt: "2026-05-10T08:00:00.000Z",
    });
    const itemSnapshot = serializeStringSnapshot(["tmdb:1", "trakt:2"]);

    expect(
      canSkipListItemFetch({
        currentMetadataCursor: metadataCursor,
        hasStableMetadata: true,
        previousItemSnapshot: itemSnapshot,
        previousMetadataCursor: metadataCursor,
      }),
    ).toBe(true);
    expect(
      canSkipListItemFetch({
        currentMetadataCursor: metadataCursor,
        hasStableMetadata: false,
        previousItemSnapshot: itemSnapshot,
        previousMetadataCursor: metadataCursor,
      }),
    ).toBe(false);
    expect(
      canSkipListItemFetch({
        currentMetadataCursor: metadataCursor,
        hasStableMetadata: true,
        previousItemSnapshot: undefined,
        previousMetadataCursor: metadataCursor,
      }),
    ).toBe(false);
  });

  it("serializes string snapshots in stable sorted order", () => {
    const snapshot = serializeStringSnapshot(["trakt:2", "tmdb:1", "trakt:2"]);

    expect(snapshot).toBe("[\"tmdb:1\",\"trakt:2\"]");
    expect(parseStringArrayCursor(snapshot)).toEqual(["tmdb:1", "trakt:2"]);
    expect(parseStringArrayCursor("not-json")).toEqual([]);
  });

  it("detects added and removed keys from a previous string snapshot", () => {
    const delta = getStringSnapshotDelta(
      ["trakt:3", "tmdb:1", "tmdb:1"],
      serializeStringSnapshot(["tmdb:1", "trakt:2"]),
    );

    expect(delta).toEqual({
      addedKeys: ["trakt:3"],
      changed: true,
      currentKeys: ["tmdb:1", "trakt:3"],
      hadPreviousSnapshot: true,
      removedKeys: ["trakt:2"],
      snapshot: "[\"tmdb:1\",\"trakt:3\"]",
    });
  });

  it("treats a missing string snapshot as a first import", () => {
    expect(getStringSnapshotDelta(["trakt:2"], undefined)).toMatchObject({
      addedKeys: ["trakt:2"],
      changed: true,
      hadPreviousSnapshot: false,
      removedKeys: [],
    });
  });

  it("serializes rating snapshots in stable key order", () => {
    const snapshot = serializeRatingSnapshot([
      ["trakt:2", 8],
      ["tmdb:1", 10],
    ]);

    expect(snapshot).toBe("{\"tmdb:1\":10,\"trakt:2\":8}");
    expect(parseRatingSnapshot(snapshot)).toEqual({
      "tmdb:1": 10,
      "trakt:2": 8,
    });
    expect(parseRatingSnapshot("[\"bad\"]")).toEqual({});
  });

  it("keeps the latest timestamp", () => {
    expect(
      latestTimestamp("2026-05-09T10:00:00.000Z", "2026-05-09T11:00:00.000Z"),
    ).toBe("2026-05-09T11:00:00.000Z");
    expect(latestTimestamp(null, "2026-05-09T11:00:00.000Z")).toBe(
      "2026-05-09T11:00:00.000Z",
    );
  });
});
