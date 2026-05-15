import type { SyncDirection, SyncRunStatus } from "@/lib/db/types";

export const activeSyncRunMaxAgeMs = 2 * 60 * 1000;

export type SyncRunProgressInput = {
  current: number;
  direction: SyncDirection;
  id: string;
  itemCurrent?: number | null;
  itemLabel?: string | null;
  itemTotal?: number | null;
  label: string;
  phase: string;
  status: SyncRunStatus;
  total: number;
  updatedAt: string | null;
};

export type SyncRunProgress = {
  current: number;
  direction: SyncDirection;
  itemCurrent: number | null;
  itemLabel: string | null;
  itemTotal: number | null;
  label: string;
  percent: number;
  phase: string;
  runId: string;
  total: number;
  updatedAt: string | null;
};

export function canStartSyncRun(
  activeRun: Pick<SyncRunProgressInput, "status" | "updatedAt"> | null,
  nowMs = Date.now(),
) {
  return !activeRun || activeRun.status !== "running" || isSyncRunStale(activeRun, nowMs);
}

export function isSyncRunStale(
  run: Pick<SyncRunProgressInput, "status" | "updatedAt">,
  nowMs = Date.now(),
  maxAgeMs = activeSyncRunMaxAgeMs,
) {
  if (run.status !== "running" || !run.updatedAt) {
    return false;
  }

  const updatedAtMs = Date.parse(run.updatedAt);

  return Number.isNaN(updatedAtMs) || nowMs - updatedAtMs > maxAgeMs;
}

export function toSyncRunProgress(run: SyncRunProgressInput): SyncRunProgress {
  const current = nonNegativeInteger(run.current);
  const total = nonNegativeInteger(run.total);
  const itemCurrent = nullableNonNegativeInteger(run.itemCurrent);
  const itemTotal = nullableNonNegativeInteger(run.itemTotal);

  return {
    current,
    direction: run.direction,
    itemCurrent,
    itemLabel: normalizeOptionalLabel(run.itemLabel),
    itemTotal,
    label: run.label.trim() || "Syncing",
    percent: syncProgressPercent(current, total, run.phase),
    phase: run.phase.trim() || "sync",
    runId: run.id,
    total,
    updatedAt: run.updatedAt,
  };
}

export function syncProgressPercent(current: number, total: number, phase: string) {
  const normalizedCurrent = nonNegativeInteger(current);
  const normalizedTotal = nonNegativeInteger(total);

  if (normalizedTotal === 0) {
    return phase === "complete" ? 100 : 0;
  }

  return Math.min(Math.round((normalizedCurrent / normalizedTotal) * 100), 100);
}

function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(Math.floor(value), 0) : 0;
}

function nullableNonNegativeInteger(value: number | null | undefined) {
  return value === null || value === undefined ? null : nonNegativeInteger(value);
}

function normalizeOptionalLabel(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}
