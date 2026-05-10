export type PullCheckpointPhase = "history" | "lists" | "ratings" | "watchlist";
export type SnapshotCursorScope = "ratings" | "watchlist" | `lists.${string}`;

export type PullCheckpoint = {
  changed: boolean;
  completedAt: string;
  cursorValue: string | null;
  itemCount: number;
  phase: PullCheckpointPhase;
  runId: string;
};

export const historyLastWatchedCursorKey = "history.last_watched_at";
export const lastPullCursorKey = "last_pull_at";
export const pullCheckpointCursorKey = "pull.checkpoint";

export function snapshotCursorKey(scope: SnapshotCursorScope) {
  return `${scope}.snapshot`;
}

export function pullPhaseCheckpointCursorKey(phase: PullCheckpointPhase) {
  return `pull.${phase}.completed_at`;
}

export function serializeStringSnapshot(values: Iterable<string>) {
  return JSON.stringify(Array.from(new Set(values)).sort());
}

export function parseStringArrayCursor(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function serializeRatingSnapshot(values: Iterable<[string, number]>) {
  return JSON.stringify(
    Object.fromEntries(
      Array.from(values)
        .filter((entry): entry is [string, number] => (
          typeof entry[0] === "string" && Number.isFinite(entry[1])
        ))
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

export function parseRatingSnapshot(value: string | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, number] => (
          typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isFinite(entry[1])
        ))
        .sort(([left], [right]) => left.localeCompare(right)),
    );
  } catch {
    return {};
  }
}

export function serializePullCheckpoint(checkpoint: PullCheckpoint) {
  return JSON.stringify(checkpoint);
}

export function latestTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  if (!left) {
    return right ?? null;
  }

  if (!right) {
    return left;
  }

  return Date.parse(left) > Date.parse(right) ? left : right;
}
