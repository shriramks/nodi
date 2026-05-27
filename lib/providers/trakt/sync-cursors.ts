export type PullCheckpointPhase =
  | "history"
  | "lists"
  | "ratings"
  | "shows.history"
  | "shows.ratings"
  | "shows.watchlist"
  | "watchlist";
export type SnapshotCursorScope =
  | "ratings"
  | "shows.ratings"
  | "shows.watchlist"
  | "watchlist"
  | `lists.${string}`;

export type PullCheckpoint = {
  changed: boolean;
  completedAt: string;
  cursorValue: string | null;
  itemCount: number;
  phase: PullCheckpointPhase;
  runId: string;
};

export type ListMetadataCursor = {
  itemKinds?: string[] | null | undefined;
  itemCount: number | null | undefined;
  tagName: string | null | undefined;
  updatedAt: string | null | undefined;
};

export type StringSnapshotDelta = {
  addedKeys: string[];
  changed: boolean;
  currentKeys: string[];
  hadPreviousSnapshot: boolean;
  removedKeys: string[];
  snapshot: string;
};

export const historyLastWatchedCursorKey = "history.last_watched_at";
export const showHistoryLastWatchedCursorKey = "shows.history.last_watched_at";
export const lastPullCursorKey = "last_pull_at";
export const pullCheckpointCursorKey = "pull.checkpoint";

export function snapshotCursorKey(scope: SnapshotCursorScope) {
  return `${scope}.snapshot`;
}

export function listMetadataCursorKey(listKey: string) {
  return `lists.${listKey}.metadata`;
}

export function pullPhaseCheckpointCursorKey(phase: PullCheckpointPhase) {
  return `pull.${phase}.completed_at`;
}

export function serializeListMetadataCursor(metadata: ListMetadataCursor) {
  return JSON.stringify({
    itemKinds: normalizeStringSnapshotKeys(metadata.itemKinds ?? []),
    itemCount: normalizeNonNegativeInteger(metadata.itemCount),
    tagName: normalizeNullableString(metadata.tagName),
    updatedAt: normalizeNullableString(metadata.updatedAt),
  });
}

export function parseListMetadataCursor(cursor: string | undefined): ListMetadataCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(cursor) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;

    return {
      itemKinds: Array.isArray(obj.itemKinds) ? normalizeStringSnapshotKeys(obj.itemKinds) : [],
      itemCount: typeof obj.itemCount === "number" ? obj.itemCount : null,
      tagName: typeof obj.tagName === "string" ? obj.tagName : null,
      updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : null,
    };
  } catch {
    return null;
  }
}

export function canSkipListItemFetch({
  currentMetadataCursor,
  hasStableMetadata,
  previousItemSnapshot,
  previousMetadataCursor,
}: {
  currentMetadataCursor: string;
  hasStableMetadata: boolean;
  previousItemSnapshot: string | undefined;
  previousMetadataCursor: string | undefined;
}) {
  return (
    hasStableMetadata &&
    previousItemSnapshot !== undefined &&
    previousMetadataCursor === currentMetadataCursor
  );
}

export function serializeStringSnapshot(values: Iterable<string>) {
  return JSON.stringify(normalizeStringSnapshotKeys(values));
}

export function parseStringArrayCursor(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? normalizeStringSnapshotKeys(parsed) : [];
  } catch {
    return [];
  }
}

export function getStringSnapshotDelta(
  currentValues: Iterable<string>,
  previousSnapshot: string | undefined,
): StringSnapshotDelta {
  const currentKeys = normalizeStringSnapshotKeys(currentValues);
  const previousKeys = parseStringArrayCursor(previousSnapshot);
  const currentKeySet = new Set(currentKeys);
  const previousKeySet = new Set(previousKeys);
  const snapshot = serializeStringSnapshot(currentKeys);
  const previousCanonicalSnapshot = serializeStringSnapshot(previousKeys);

  return {
    addedKeys: currentKeys.filter((key) => !previousKeySet.has(key)),
    changed: previousSnapshot === undefined || snapshot !== previousCanonicalSnapshot,
    currentKeys,
    hadPreviousSnapshot: previousSnapshot !== undefined,
    removedKeys: previousKeys.filter((key) => !currentKeySet.has(key)),
    snapshot,
  };
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

function normalizeStringSnapshotKeys(values: Iterable<unknown>) {
  return Array.from(
    new Set(
      Array.from(values).filter((value): value is string => typeof value === "string"),
    ),
  ).sort();
}

function normalizeNonNegativeInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized ? normalized : null;
}
