import { describe, expect, it } from "vitest";

import {
  latestTimestamp,
  parseRatingSnapshot,
  parseStringArrayCursor,
  pullPhaseCheckpointCursorKey,
  serializeRatingSnapshot,
  serializeStringSnapshot,
  snapshotCursorKey,
} from "@/lib/providers/trakt/sync-cursors";

describe("Trakt sync cursors", () => {
  it("uses stable snapshot cursor names for current and future scopes", () => {
    expect(snapshotCursorKey("watchlist")).toBe("watchlist.snapshot");
    expect(snapshotCursorKey("ratings")).toBe("ratings.snapshot");
    expect(snapshotCursorKey("lists.favorites")).toBe("lists.favorites.snapshot");
    expect(pullPhaseCheckpointCursorKey("history")).toBe("pull.history.completed_at");
    expect(pullPhaseCheckpointCursorKey("lists")).toBe("pull.lists.completed_at");
  });

  it("serializes string snapshots in stable sorted order", () => {
    const snapshot = serializeStringSnapshot(["trakt:2", "tmdb:1", "trakt:2"]);

    expect(snapshot).toBe("[\"tmdb:1\",\"trakt:2\"]");
    expect(parseStringArrayCursor(snapshot)).toEqual(["tmdb:1", "trakt:2"]);
    expect(parseStringArrayCursor("not-json")).toEqual([]);
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
