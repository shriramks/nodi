import { describe, expect, it } from "vitest";

import {
  activeSyncRunMaxAgeMs,
  canStartSyncRun,
  isSyncRunStale,
  syncProgressPercent,
  toSyncRunProgress,
} from "@/lib/db/queries/sync-run-state";

const nowMs = Date.parse("2026-05-09T12:00:00.000Z");

describe("sync run state helpers", () => {
  it("treats stale running rows as startable", () => {
    const updatedAt = new Date(nowMs - activeSyncRunMaxAgeMs - 1).toISOString();

    expect(isSyncRunStale({ status: "running", updatedAt }, nowMs)).toBe(true);
    expect(canStartSyncRun({ status: "running", updatedAt }, nowMs)).toBe(true);
  });

  it("keeps fresh running rows locked", () => {
    const updatedAt = new Date(nowMs - activeSyncRunMaxAgeMs + 1).toISOString();

    expect(isSyncRunStale({ status: "running", updatedAt }, nowMs)).toBe(false);
    expect(canStartSyncRun({ status: "running", updatedAt }, nowMs)).toBe(false);
  });

  it("allows non-running terminal rows to be replaced", () => {
    expect(
      canStartSyncRun({
        status: "cancelled",
        updatedAt: "2026-05-09T11:59:00.000Z",
      }, nowMs),
    ).toBe(true);
  });

  it("normalizes progress percentages", () => {
    expect(syncProgressPercent(5, 20, "reconcile")).toBe(25);
    expect(syncProgressPercent(30, 20, "reconcile")).toBe(100);
    expect(syncProgressPercent(0, 0, "connect")).toBe(0);
    expect(syncProgressPercent(0, 0, "complete")).toBe(100);
  });

  it("builds UI progress from a run row", () => {
    expect(
      toSyncRunProgress({
        current: 2,
        direction: "pull",
        id: "run-1",
        label: "Loading history",
        phase: "fetch",
        status: "running",
        total: 4,
        updatedAt: "2026-05-09T12:00:00.000Z",
      }),
    ).toEqual({
      current: 2,
      direction: "pull",
      label: "Loading history",
      percent: 50,
      phase: "fetch",
      runId: "run-1",
      total: 4,
      updatedAt: "2026-05-09T12:00:00.000Z",
    });
  });
});
