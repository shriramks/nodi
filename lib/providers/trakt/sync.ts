import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { createSyncEvent, updateSyncEventStatus, upsertSyncCursor } from "@/lib/db/mutations";
import { listPendingSyncEvents } from "@/lib/db/queries";
import { activeSyncRunMaxAgeMs } from "@/lib/db/queries/sync-run-state";
import type {
  Json,
  Episode,
  MediaItem,
  MediaItemInsert,
  MediaProviderMapping,
  MediaProviderMappingInsert,
  MediaStatus,
  MediaWatchActivityInsert,
  SyncDirection,
  SyncEvent,
  SyncItemFailure,
  SyncItemFailureInsert,
  SyncRunStatus,
  Tag,
  TagInsert,
} from "@/lib/db/types";
import { AppError, getErrorMessage, isAppError } from "@/lib/errors";
import {
  toRemoteTraktMovieState,
  toRemoteTraktRatingState,
  toRemoteTraktEpisodeHistoryState,
  toRemoteTraktShowState,
  toRemoteTraktShowRatingState,
  toRemoteTraktShowWatchlistState,
  toRemoteTraktWatchlistState,
  toTraktHistoryEpisode,
  toTraktHistoryMovie,
  toTraktRatedMovie,
  toTraktRatedShow,
  toTraktSyncShow,
  toTraktSyncMovie,
  type RemoteTraktEpisodeHistoryState,
  type RemoteTraktEpisodeState,
  type RemoteTraktMovieState,
  type RemoteTraktRatingState,
  type RemoteTraktShowRatingState,
  type RemoteTraktShowState,
  type RemoteTraktShowWatchlistState,
  type RemoteTraktWatchlistState,
} from "@/lib/providers/trakt/adapters";
import {
  addTraktHistory,
  addTraktWatchlist,
  getTraktUserSettings,
  listTraktHistoryMoviesPage,
  listTraktHistoryShowsPage,
  listTraktListMovieItemsPage,
  listTraktListShowItemsPage,
  listTraktRatedMoviesPage,
  listTraktRatedShowsPage,
  listTraktUserListsPage,
  listTraktWatchlistMoviesPage,
  listTraktWatchlistShowsPage,
  removeTraktHistory,
  removeTraktRatings,
  removeTraktWatchlist,
  setTraktRatings,
  type TraktHistoryEpisode,
  type TraktHistoryMovie,
  type TraktAuth,
  type TraktListMovie,
  type TraktListShow,
  type TraktPagination,
  type TraktRatedMovie,
  type TraktRatedShow,
  type TraktSyncEpisode,
  type TraktSyncMovie,
  type TraktSyncResponse,
  type TraktSyncShow,
  type TraktUserList,
  type TraktWatchlistMovie,
  type TraktWatchlistShow,
} from "@/lib/providers/trakt/client";
import { loadTraktSyncCredentials } from "@/lib/providers/trakt/credentials";
import {
  canSkipListItemFetch,
  getStringSnapshotDelta,
  historyLastWatchedCursorKey,
  lastPullCursorKey,
  latestTimestamp,
  listMetadataCursorKey,
  parseRatingSnapshot,
  parseStringArrayCursor,
  pullCheckpointCursorKey,
  pullPhaseCheckpointCursorKey,
  serializeListMetadataCursor,
  serializePullCheckpoint,
  serializeRatingSnapshot,
  serializeStringSnapshot,
  showHistoryBootstrapCursorKey,
  showHistoryLastWatchedCursorKey,
  snapshotCursorKey,
  type PullCheckpointPhase,
} from "@/lib/providers/trakt/sync-cursors";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type PushResult = {
  failed: number;
  processed: number;
  skipped: number;
  succeeded: number;
};

type PullResult = {
  failed: number;
  failureSamples: string[];
  episodeHistoryImported: number;
  historyImported: number;
  listItemFetchesSkipped: number;
  listItemsTagged: number;
  listsImported: number;
  ratingsCleared: number;
  ratingsImported: number;
  retryableFailures: number;
  showRatingsCleared: number;
  showRatingsImported: number;
  showWatchlistImported: number;
  showWatchlistRemoved: number;
  skipped: number;
  watchlistImported: number;
  watchlistRemoved: number;
};

type PullMode = "full" | "shows";
type PullTraktSyncOptions = {
  mode?: PullMode;
};

type SyncProgressPayload = {
  current: number;
  itemCurrent?: number | null;
  itemLabel?: string | null;
  itemTotal?: number | null;
  label: string;
  phase: string;
  total: number;
};

type CursorMap = Map<string, string>;
type SyncRunTerminalStatus = Exclude<SyncRunStatus, "running">;
type SyncRunContext = { runId: string; userId: string };
type ProviderCandidate = { id: string; provider: "imdb" | "tmdb" | "trakt" };
type TraktListItemKind = "movie" | "show";
type RemoteHistoryState = {
  item: TraktHistoryMovie;
  movie: RemoteTraktMovieState;
};
type TraktListImport = {
  cursorKey: string;
  itemFetchSkipped: boolean;
  itemFetchComplete: boolean;
  listKey: string;
  metadataCursor: string;
  movieItems: TraktListMovie[];
  previousMetadataCursor: string | undefined;
  previousSnapshot: string | undefined;
  showItems: TraktListShow[];
  tagName: string;
};
type TraktListFetchProgress = {
  itemCount: number;
  listCount: number;
  skippedListCount: number;
  totalItemCount: number | null;
};
type TraktListFetchResult = {
  imports: TraktListImport[];
  itemCount: number;
  skippedListCount: number;
  totalItemCount: number | null;
};
type RemoteTraktListState = {
  changed: boolean;
  cursorKey: string;
  itemFetchSkipped: boolean;
  itemFetchComplete: boolean;
  listKey: string;
  metadataCursor: string;
  movieStates: RemoteTraktMovieState[];
  movieStatesToTag: RemoteTraktMovieState[];
  removedKeys: string[];
  showStates: RemoteTraktShowState[];
  showStatesToTag: RemoteTraktShowState[];
  snapshot: string;
  tagName: string;
};
type PullFailurePhase =
  | "episode"
  | "history"
  | "library"
  | "list"
  | "mapping"
  | "metadata"
  | "rating"
  | "show"
  | "tag"
  | "watch-log"
  | "watchlist";
type PullItemFailure = {
  errorMessage: string;
  itemKey: string;
  itemPayload: Json;
  phase: PullFailurePhase;
};
type MovieResolutionResult = {
  failedRemoteKeys: Map<string, string>;
  movieIdByRemoteKey: Map<string, string>;
  remoteMoviesByKey: Map<string, RemoteTraktMovieState>;
};
type ShowResolutionResult = {
  failedRemoteKeys: Map<string, string>;
  mediaIdByRemoteKey: Map<string, string>;
  remoteShowsByKey: Map<string, RemoteTraktShowState>;
};
type EpisodeResolutionResult = {
  episodeIdByRemoteKey: Map<string, string>;
  failedRemoteKeys: Map<string, string>;
  remoteEpisodesByKey: Map<string, RemoteTraktEpisodeState>;
};
type UserMediaDraft = {
  completedAt: string | null;
  completionMode: "manual" | "auto_all_aired" | null;
  lastWatchedAt: string | null;
  mediaId: string;
  personalRating: number | null;
  status: MediaStatus;
  watchlistedAt: string | null;
};
type PushOperation =
  | "episode.history.add"
  | "episode.history.remove"
  | "history.add"
  | "history.remove"
  | "ratings.remove"
  | "ratings.set"
  | "show.ratings.remove"
  | "show.ratings.set"
  | "show.watchlist.add"
  | "show.watchlist.remove"
  | "watchlist.add"
  | "watchlist.remove";
type PreparedPushEvent = {
  episode?: TraktSyncEpisode;
  event: SyncEvent;
  movie?: TraktSyncMovie;
  operation: PushOperation;
  show?: TraktSyncShow;
};

const provider = "trakt" as const;
const pageLimit = 100;
const maxBootstrapPages = 1000;
const dbReadChunkSize = 500;
const dbWriteChunkSize = 200;
const failureSampleLimit = 10;
const staleSyncMessage = "Sync run stopped reporting progress and was marked failed.";
const importedTagNameMaxLength = 80;
const pullItemFailuresByResult = new WeakMap<PullResult, Map<string, PullItemFailure>>();

export async function pushTraktSync(origin: string, limit = 50): Promise<PushResult> {
  const user = await requireUser();
  const run = await createTraktSyncRun(user.id, "push", {
    current: 0,
    label: "Connecting to Trakt",
    phase: "connect",
    total: 0,
  });
  let progressCurrent = 0;
  let progressTotal = 0;

  try {
    await assertTraktSyncRunActive(user.id, run.id);
    const connection = await loadTraktSyncCredentials(user.id, origin);
    await refreshTraktConnection(user.id, connection);

    const events = await listPendingSyncEvents(provider, "push", limit);
    progressTotal = events.length;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: 0,
      itemCurrent: 0,
      itemLabel: "events",
      itemTotal: progressTotal,
      label: events.length > 0 ? `Pushing ${events.length} change(s)` : "No changes to push",
      phase: "push",
      total: progressTotal,
    });

    const result: PushResult = {
      failed: 0,
      processed: events.length,
      skipped: 0,
      succeeded: 0,
    };

    for (let index = 0; index < events.length;) {
      await assertTraktSyncRunActive(user.id, run.id);

      const event = events[index];
      const skipReason = getPushSkipReason(event);

      if (skipReason) {
        await updateSyncEventStatus(event.id, {
          payload: withSyncResult(event.payload, {
            reason: skipReason,
            skipped: true,
          }),
          processedAt: new Date().toISOString(),
          status: "success",
        });
        result.skipped += 1;
        progressCurrent += 1;
        await updateTraktSyncRunProgress(user.id, run.id, {
          current: progressCurrent,
          itemCurrent: progressCurrent,
          itemLabel: "events",
          itemTotal: progressTotal,
          label: `Processed ${progressCurrent} of ${progressTotal}`,
          phase: "push",
          total: progressTotal,
        });
        index += 1;
        continue;
      }

      let operation: PushOperation;

      try {
        operation = getPushOperation(event);
      } catch (error) {
        result.failed += 1;
        await updateSyncEventStatus(event.id, {
          errorMessage: getErrorMessage(error),
          payload: event.payload,
          processedAt: new Date().toISOString(),
          status: "error",
        });
        progressCurrent += 1;
        await updateTraktSyncRunProgress(user.id, run.id, {
          current: progressCurrent,
          itemCurrent: progressCurrent,
          itemLabel: "events",
          itemTotal: progressTotal,
          label: `Processed ${progressCurrent} of ${progressTotal}`,
          phase: "push",
          total: progressTotal,
        });
        index += 1;
        continue;
      }

      const batchEvents = takeAdjacentPushEvents(events, index, operation);
      const batch: PreparedPushEvent[] = [];

      for (const batchEvent of batchEvents) {
        try {
          batch.push(await preparePushEvent(batchEvent, operation));
        } catch (error) {
          result.failed += 1;
          await updateSyncEventStatus(batchEvent.id, {
            errorMessage: getErrorMessage(error),
            payload: batchEvent.payload,
            processedAt: new Date().toISOString(),
            status: "error",
          });
        }
      }

      if (batch.length > 0) {
        try {
          const pushResponse = await pushPreparedBatch(connection, batch);
          const processedAt = new Date().toISOString();

          for (const prepared of batch) {
            await updateSyncEventStatus(prepared.event.id, {
              payload: withSyncResult(prepared.event.payload, pushResponse),
              processedAt,
              status: "success",
            });
          }
          result.succeeded += batch.length;
        } catch (error) {
          const processedAt = new Date().toISOString();

          for (const prepared of batch) {
            result.failed += 1;
            await updateSyncEventStatus(prepared.event.id, {
              errorMessage: getErrorMessage(error),
              payload: prepared.event.payload,
              processedAt,
              status: "error",
            });
          }
        }
      }

      progressCurrent += batchEvents.length;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: progressCurrent,
        itemCurrent: progressCurrent,
        itemLabel: "events",
        itemTotal: progressTotal,
        label: `Processed ${progressCurrent} of ${progressTotal}`,
        phase: "push",
        total: progressTotal,
      });

      index += batchEvents.length;
    }

    const processedAt = new Date().toISOString();
    await upsertSyncCursor(provider, "last_push_at", processedAt);
    await createSyncEvent({
      provider,
      direction: "push",
      eventType: "trakt.push.summary",
      status: result.failed > 0 ? "error" : "success",
      payload: result as unknown as Json,
      errorMessage: result.failed > 0 ? `${result.failed} Trakt push event(s) failed.` : null,
      processedAt,
    });
    await finishTraktSyncRun(
      user.id,
      run.id,
      result.failed > 0 ? "error" : "success",
      {
        current: progressTotal,
        itemCurrent: progressTotal,
        itemLabel: "events",
        itemTotal: progressTotal,
        label: result.failed > 0 ? "Push completed with failures" : "Push complete",
        phase: "complete",
        total: progressTotal,
      },
      result as unknown as Json,
      result.failed > 0 ? `${result.failed} Trakt push event(s) failed.` : null,
    );

    return result;
  } catch (error) {
    const cancelled = isSyncRunCancelledError(error);
    await finishTraktSyncRun(
      user.id,
      run.id,
      cancelled ? "cancelled" : "error",
      {
        current: progressCurrent,
        itemCurrent: progressCurrent,
        itemLabel: "events",
        itemTotal: progressTotal,
        label: cancelled ? "Push stopped" : "Push failed",
        phase: cancelled ? "cancelled" : "error",
        total: progressTotal,
      },
      {},
      getErrorMessage(error),
    );
    throw error;
  }
}

export async function pullTraktSync(origin: string): Promise<PullResult> {
  return pullTraktSyncWithOptions(origin);
}

export async function pullTraktSyncWithOptions(
  origin: string,
  options: PullTraktSyncOptions = {},
): Promise<PullResult> {
  const user = await requireUser();
  const mode = options.mode ?? "full";
  const includeMovies = mode === "full";
  const fetchTotal = includeMovies ? 8 : 5;
  const run = await createTraktSyncRun(user.id, "pull", {
    current: 0,
    label: "Connecting to Trakt",
    phase: "connect",
    total: fetchTotal,
  });
  let progressCurrent = 0;
  let progressTotal = fetchTotal;

  try {
    await assertTraktSyncRunActive(user.id, run.id);
    const connection = await loadTraktSyncCredentials(user.id, origin);
    await refreshTraktConnection(user.id, connection);

    const cursors = await loadCursorMap(user.id);
    const result = createPullResult();
    const runContext = { runId: run.id, userId: user.id };
    let fetchCurrent = 0;
    let historyItems: TraktHistoryMovie[] = [];
    let watchlistItems: TraktWatchlistMovie[] = [];
    let ratingItems: TraktRatedMovie[] = [];

    const historyCursor = cursors.get(historyLastWatchedCursorKey) ?? null;
    if (includeMovies) {
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: fetchCurrent,
        label: "Loading history",
        phase: "fetch",
        total: fetchTotal,
      });
      historyItems = await listAllHistory(
        connection,
        historyCursor,
        runContext,
        async (count, total) => {
          await updateTraktSyncRunProgress(user.id, run.id, {
            current: fetchCurrent,
            itemCurrent: count,
            itemLabel: "history items",
            itemTotal: total,
            label: `Loaded ${count} history item(s)`,
            phase: "fetch",
            total: fetchTotal,
          });
        },
      );
      fetchCurrent += 1;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: fetchCurrent,
        itemCurrent: historyItems.length,
        itemLabel: "history items",
        itemTotal: historyItems.length,
        label: `Loaded ${historyItems.length} history item(s)`,
        phase: "fetch",
        total: fetchTotal,
      });

      watchlistItems = await listAllWatchlist(connection, runContext, async (count, total) => {
        await updateTraktSyncRunProgress(user.id, run.id, {
          current: fetchCurrent,
          itemCurrent: count,
          itemLabel: "watchlist items",
          itemTotal: total,
          label: `Loaded ${count} watchlist item(s)`,
          phase: "fetch",
          total: fetchTotal,
        });
      });
      fetchCurrent += 1;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: fetchCurrent,
        itemCurrent: watchlistItems.length,
        itemLabel: "watchlist items",
        itemTotal: watchlistItems.length,
        label: `Loaded ${watchlistItems.length} watchlist item(s)`,
        phase: "fetch",
        total: fetchTotal,
      });

      ratingItems = await listAllRatings(connection, runContext, async (count, total) => {
        await updateTraktSyncRunProgress(user.id, run.id, {
          current: fetchCurrent,
          itemCurrent: count,
          itemLabel: "ratings",
          itemTotal: total,
          label: `Loaded ${count} rating(s)`,
          phase: "fetch",
          total: fetchTotal,
        });
      });
      fetchCurrent += 1;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: fetchCurrent,
        itemCurrent: ratingItems.length,
        itemLabel: "ratings",
        itemTotal: ratingItems.length,
        label: `Loaded ${ratingItems.length} rating(s)`,
        phase: "fetch",
        total: fetchTotal,
      });
    }

    const showHistoryCursor = cursors.get(showHistoryLastWatchedCursorKey) ?? null;
    const showHistoryItems = await listAllShowHistory(
      connection,
      showHistoryCursor,
      runContext,
      async (count, total) => {
        await updateTraktSyncRunProgress(user.id, run.id, {
          current: fetchCurrent,
          itemCurrent: count,
          itemLabel: "episode history items",
          itemTotal: total,
          label: `Loaded ${count} episode history item(s)`,
          phase: "fetch",
          total: fetchTotal,
        });
      },
    );
    fetchCurrent += 1;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: fetchCurrent,
      itemCurrent: showHistoryItems.length,
      itemLabel: "episode history items",
      itemTotal: showHistoryItems.length,
      label: `Loaded ${showHistoryItems.length} episode history item(s)`,
      phase: "fetch",
      total: fetchTotal,
    });

    const showWatchlistItems = await listAllShowWatchlist(connection, runContext, async (count, total) => {
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: fetchCurrent,
        itemCurrent: count,
        itemLabel: "show watchlist items",
        itemTotal: total,
        label: `Loaded ${count} show watchlist item(s)`,
        phase: "fetch",
        total: fetchTotal,
      });
    });
    fetchCurrent += 1;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: fetchCurrent,
      itemCurrent: showWatchlistItems.length,
      itemLabel: "show watchlist items",
      itemTotal: showWatchlistItems.length,
      label: `Loaded ${showWatchlistItems.length} show watchlist item(s)`,
      phase: "fetch",
      total: fetchTotal,
    });

    const showRatingItems = await listAllShowRatings(connection, runContext, async (count, total) => {
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: fetchCurrent,
        itemCurrent: count,
        itemLabel: "show ratings",
        itemTotal: total,
        label: `Loaded ${count} show rating(s)`,
        phase: "fetch",
        total: fetchTotal,
      });
    });
    fetchCurrent += 1;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: fetchCurrent,
      itemCurrent: showRatingItems.length,
      itemLabel: "show ratings",
      itemTotal: showRatingItems.length,
      label: `Loaded ${showRatingItems.length} show rating(s)`,
      phase: "fetch",
      total: fetchTotal,
    });

    const listFetch = await listAllListsWithTaggableItems(
      connection,
      cursors,
      result,
      runContext,
      { itemKinds: includeMovies ? ["movie", "show"] : ["show"] },
      async (counts) => {
        await updateTraktSyncRunProgress(user.id, run.id, {
          current: fetchCurrent,
          itemCurrent: counts.itemCount,
          itemLabel: "list items",
          itemTotal: counts.totalItemCount,
          label: formatListFetchProgressLabel(counts),
          phase: "fetch",
          total: fetchTotal,
        });
      },
    );
    const listImports = listFetch.imports;
    result.listItemFetchesSkipped = listFetch.skippedListCount;
    fetchCurrent += 1;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: fetchCurrent,
      itemCurrent: listFetch.itemCount,
      itemLabel: "list items",
      itemTotal: listFetch.totalItemCount ?? listFetch.itemCount,
      label: formatListFetchProgressLabel({
        itemCount: listFetch.itemCount,
        listCount: listImports.length,
        skippedListCount: listFetch.skippedListCount,
        totalItemCount: listFetch.totalItemCount,
      }),
      phase: "fetch",
      total: fetchTotal,
    });

    const historyStates = normalizeHistoryStates(historyItems, result);
    const watchlistStates = normalizeWatchlistStates(watchlistItems, result);
    const ratingStates = normalizeRatingStates(ratingItems, result);
    const showHistoryStates = normalizeShowHistoryStates(showHistoryItems, result);
    const showWatchlistStates = normalizeShowWatchlistStates(showWatchlistItems, result);
    const showRatingStates = normalizeShowRatingStates(showRatingItems, result);
    const listStates = normalizeListStates(listImports, cursors, result);
    const listStatesToTag = listStates.filter(
      (list) => list.movieStatesToTag.length > 0 || list.showStatesToTag.length > 0,
    );
    const changedListCount = listStates.filter((list) => list.changed).length;
    let watchlistSnapshot = serializeStringSnapshot([]);
    let watchlistChanged = false;
    let ratingSnapshot = serializeRatingSnapshot([]);
    let ratingsChanged = false;
    let activeWatchlistStates: RemoteTraktWatchlistState[] = [];
    let activeRemovedWatchlistKeys: string[] = [];
    let activeRatingStates: RemoteTraktRatingState[] = [];
    let activeRemovedRatingKeys: string[] = [];

    if (includeMovies) {
      const currentWatchlistKeys = new Set(watchlistStates.map((item) => item.key));
      const rawWatchlistSnapshot = cursors.get(snapshotCursorKey("watchlist"));
      watchlistSnapshot = serializeStringSnapshot(currentWatchlistKeys);
      const previousWatchlistSnapshot = serializeStringSnapshot(
        parseStringArrayCursor(rawWatchlistSnapshot),
      );
      watchlistChanged = rawWatchlistSnapshot === undefined ||
        watchlistSnapshot !== previousWatchlistSnapshot;
      const previousWatchlistKeys = parseStringArrayCursor(
        rawWatchlistSnapshot,
      );
      const removedWatchlistKeys = previousWatchlistKeys.filter(
        (key) => !currentWatchlistKeys.has(key),
      );
      const currentRatings = new Map(ratingStates.map((item) => [item.key, item.rating]));
      const rawRatingSnapshot = cursors.get(snapshotCursorKey("ratings"));
      ratingSnapshot = serializeRatingSnapshot(currentRatings.entries());
      const previousRatingSnapshot = serializeRatingSnapshot(
        Object.entries(parseRatingSnapshot(rawRatingSnapshot)),
      );
      ratingsChanged = rawRatingSnapshot === undefined ||
        ratingSnapshot !== previousRatingSnapshot;
      const previousRatingKeys = Object.keys(
        parseRatingSnapshot(rawRatingSnapshot),
      );
      const removedRatingKeys = previousRatingKeys.filter((key) => !currentRatings.has(key));
      activeWatchlistStates = watchlistChanged ? watchlistStates : [];
      activeRemovedWatchlistKeys = watchlistChanged ? removedWatchlistKeys : [];
      activeRatingStates = ratingsChanged ? ratingStates : [];
      activeRemovedRatingKeys = ratingsChanged ? removedRatingKeys : [];
    }
    const currentShowWatchlistKeys = new Set(showWatchlistStates.map((item) => item.key));
    const rawShowWatchlistSnapshot = cursors.get(snapshotCursorKey("shows.watchlist"));
    const showWatchlistSnapshot = serializeStringSnapshot(currentShowWatchlistKeys);
    const previousShowWatchlistSnapshot = serializeStringSnapshot(
      parseStringArrayCursor(rawShowWatchlistSnapshot),
    );
    const showWatchlistChanged = rawShowWatchlistSnapshot === undefined ||
      showWatchlistSnapshot !== previousShowWatchlistSnapshot;
    const previousShowWatchlistKeys = parseStringArrayCursor(rawShowWatchlistSnapshot);
    const removedShowWatchlistKeys = previousShowWatchlistKeys.filter(
      (key) => !currentShowWatchlistKeys.has(key),
    );
    const currentShowRatings = new Map(showRatingStates.map((item) => [item.key, item.rating]));
    const rawShowRatingSnapshot = cursors.get(snapshotCursorKey("shows.ratings"));
    const showRatingSnapshot = serializeRatingSnapshot(currentShowRatings.entries());
    const previousShowRatingSnapshot = serializeRatingSnapshot(
      Object.entries(parseRatingSnapshot(rawShowRatingSnapshot)),
    );
    const showRatingsChanged = rawShowRatingSnapshot === undefined ||
      showRatingSnapshot !== previousShowRatingSnapshot;
    const previousShowRatingKeys = Object.keys(parseRatingSnapshot(rawShowRatingSnapshot));
    const removedShowRatingKeys = previousShowRatingKeys.filter((key) => !currentShowRatings.has(key));
    const activeShowWatchlistStates = showWatchlistChanged ? showWatchlistStates : [];
    const activeRemovedShowWatchlistKeys = showWatchlistChanged ? removedShowWatchlistKeys : [];
    const activeShowRatingStates = showRatingsChanged ? showRatingStates : [];
    const activeRemovedShowRatingKeys = showRatingsChanged ? removedShowRatingKeys : [];
    const activeReconcileItemCount =
      historyStates.length +
      activeWatchlistStates.length +
      activeRemovedWatchlistKeys.length +
      activeRatingStates.length +
      activeRemovedRatingKeys.length +
      showHistoryStates.length +
      activeShowWatchlistStates.length +
      activeRemovedShowWatchlistKeys.length +
      activeShowRatingStates.length +
      activeRemovedShowRatingKeys.length +
      listStatesToTag.reduce(
        (count, list) => count + list.movieStatesToTag.length + list.showStatesToTag.length,
        0,
      );
    const reconcileBatchCount = Math.ceil(activeReconcileItemCount / dbWriteChunkSize);

    progressTotal = (includeMovies ? 9 : 4) + reconcileBatchCount;
    progressCurrent = 0;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: progressCurrent,
      itemCurrent: 0,
      itemLabel: "items",
      itemTotal: activeReconcileItemCount,
      label: includeMovies ? "Resolving Trakt movies" : "Resolving Trakt shows",
      phase: "reconcile",
      total: progressTotal,
    });

    let movieResolution: MovieResolutionResult = {
      failedRemoteKeys: new Map(),
      movieIdByRemoteKey: new Map(),
      remoteMoviesByKey: new Map(),
    };

    if (includeMovies) {
      movieResolution = await resolveRemoteMovies({
        remoteKeys: [...activeRemovedWatchlistKeys, ...activeRemovedRatingKeys],
        remoteMovies: [
          ...historyStates.map((state) => state.movie),
          ...activeWatchlistStates,
          ...activeRatingStates,
          ...listStatesToTag.flatMap((list) => list.movieStatesToTag),
        ],
        result,
        run: runContext,
      });
      progressCurrent += 1;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: progressCurrent,
        itemCurrent: 0,
        itemLabel: "items",
        itemTotal: activeReconcileItemCount,
        label: `Resolved ${movieResolution.movieIdByRemoteKey.size} movie key(s)`,
        phase: "reconcile",
        total: progressTotal,
      });

      await upsertResolvedMovieProviderMappings(movieResolution, result, runContext);
      progressCurrent += 1;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: progressCurrent,
        itemCurrent: 0,
        itemLabel: "items",
        itemTotal: activeReconcileItemCount,
        label: "Prepared provider mappings",
        phase: "reconcile",
        total: progressTotal,
      });
    }

    const showResolution = await resolveRemoteShows({
      remoteKeys: [...activeRemovedShowWatchlistKeys, ...activeRemovedShowRatingKeys],
      remoteShows: [
        ...showHistoryStates.map((state) => state.show),
        ...activeShowWatchlistStates,
        ...activeShowRatingStates,
        ...listStatesToTag.flatMap((list) => list.showStatesToTag),
      ],
      result,
      run: runContext,
    });
    await upsertResolvedShowProviderMappings(showResolution, result, runContext);
    const episodeResolution = await resolveRemoteEpisodes({
      historyStates: showHistoryStates,
      result,
      run: runContext,
      showResolution,
    });
    progressCurrent += 1;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: progressCurrent,
      itemCurrent: 0,
      itemLabel: "items",
      itemTotal: activeReconcileItemCount,
      label: `Resolved ${showResolution.mediaIdByRemoteKey.size} show key(s)`,
      phase: "reconcile",
      total: progressTotal,
    });

    const pendingMovieIds = includeMovies ? await loadPendingPushMovieIds(user.id) : new Set<string>();
    const pendingMediaIds = await loadPendingPushMediaIds(user.id);
    const existingUserMovies = includeMovies
      ? await loadUserMovieMap(
        user.id,
        movieResolution.movieIdByRemoteKey.values(),
        runContext,
      )
      : new Map<string, UserMediaDraft>();
    const existingUserMedia = await loadUserMediaMap(
      user.id,
      showResolution.mediaIdByRemoteKey.values(),
      runContext,
    );
    progressCurrent += 1;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: progressCurrent,
      itemCurrent: 0,
      itemLabel: "items",
      itemTotal: activeReconcileItemCount,
      label: "Loaded local library state",
      phase: "reconcile",
      total: progressTotal,
    });

    if (includeMovies) {
      const historyPlan = planPullUserMovieWrites({
        existingUserMovies,
        historyStates,
        movieResolution,
        pendingMovieIds,
        ratingStates: [],
        removedRatingKeys: [],
        removedWatchlistKeys: [],
        result,
        watchlistStates: [],
      });

      await upsertUserMovieDrafts(user.id, historyPlan.upserts, result, runContext);
      applyUserMoviePlanToMap(existingUserMovies, historyPlan);
      await insertMediaWatchActivity(user.id, historyPlan.watchActivityRows, result, runContext);
      await flushPendingPullItemFailures(runContext, result);
      await storeHistoryCheckpoint(runContext, {
        changed: historyStates.length > 0,
        itemCount: historyStates.length,
        newestWatchedAt: historyPlan.newestWatchedAt ?? historyCursor,
      });
      progressCurrent += 1;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: progressCurrent,
        itemCurrent: historyStates.length,
        itemLabel: "items",
        itemTotal: activeReconcileItemCount,
        label: `History checkpoint saved (${historyStates.length} item(s))`,
        phase: "reconcile",
        total: progressTotal,
      });

      const watchlistPlan = planPullUserMovieWrites({
        existingUserMovies,
        historyStates: [],
        movieResolution,
        pendingMovieIds,
        ratingStates: [],
        removedRatingKeys: [],
        removedWatchlistKeys: activeRemovedWatchlistKeys,
        result,
        watchlistStates: activeWatchlistStates,
      });

      await deleteUserMedia(user.id, watchlistPlan.deleteMediaIds, result, runContext);
      await upsertUserMovieDrafts(user.id, watchlistPlan.upserts, result, runContext);
      applyUserMoviePlanToMap(existingUserMovies, watchlistPlan);
      await flushPendingPullItemFailures(runContext, result);
      await storeSnapshotCheckpoint("watchlist", runContext, {
        changed: watchlistChanged,
        itemCount: activeWatchlistStates.length + activeRemovedWatchlistKeys.length,
        snapshot: watchlistSnapshot,
      });
      progressCurrent += 1;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: progressCurrent,
        itemCurrent: historyStates.length +
          activeWatchlistStates.length +
          activeRemovedWatchlistKeys.length,
        itemLabel: "items",
        itemTotal: activeReconcileItemCount,
        label: watchlistChanged ? "Watchlist checkpoint saved" : "Watchlist unchanged",
        phase: "reconcile",
        total: progressTotal,
      });

      const ratingPlan = planPullUserMovieWrites({
        existingUserMovies,
        historyStates: [],
        movieResolution,
        pendingMovieIds,
        ratingStates: activeRatingStates,
        removedRatingKeys: activeRemovedRatingKeys,
        removedWatchlistKeys: [],
        result,
        watchlistStates: [],
      });

      await upsertUserMovieDrafts(user.id, ratingPlan.upserts, result, runContext);
      applyUserMoviePlanToMap(existingUserMovies, ratingPlan);
      await flushPendingPullItemFailures(runContext, result);
      await storeSnapshotCheckpoint("ratings", runContext, {
        changed: ratingsChanged,
        itemCount: activeRatingStates.length + activeRemovedRatingKeys.length,
        snapshot: ratingSnapshot,
      });
      progressCurrent += 1;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: progressCurrent,
        itemCurrent: historyStates.length +
          activeWatchlistStates.length +
          activeRemovedWatchlistKeys.length +
          activeRatingStates.length +
          activeRemovedRatingKeys.length,
        itemLabel: "items",
        itemTotal: activeReconcileItemCount,
        label: ratingsChanged ? "Ratings checkpoint saved" : "Ratings unchanged",
        phase: "reconcile",
        total: progressTotal,
      });
    }

    // Sort show history ascending so we can commit a resumable cursor after each batch.
    // On bootstrap (showHistoryCursor = null) a prior interrupted run may have saved a
    // bootstrap cursor; filter out already-processed items so we pick up where we left off.
    const showHistoryBootstrapCursor = cursors.get(showHistoryBootstrapCursorKey) || null;
    const bootstrapIsResume = !showHistoryCursor && showHistoryBootstrapCursor !== null;
    const sortedShowHistoryStates = showHistoryStates
      .filter((s) => !bootstrapIsResume || s.item.watched_at > showHistoryBootstrapCursor)
      .sort((a, b) => a.item.watched_at.localeCompare(b.item.watched_at));
    const showHistoryBatchSize = 500;
    const showHistoryBatches = chunkArray(sortedShowHistoryStates, showHistoryBatchSize);
    let showHistoryProcessed = 0;
    let overallNewestShowWatchedAt: string | null = showHistoryBootstrapCursor;

    for (const batch of showHistoryBatches) {
      const batchPlan = planPullUserMediaWrites({
        episodeResolution,
        existingUserMedia,
        pendingMediaIds,
        removedRatingKeys: [],
        removedWatchlistKeys: [],
        result,
        showHistoryStates: batch,
        showRatingStates: [],
        showResolution,
        showWatchlistStates: [],
      });

      await upsertUserMediaDrafts(user.id, batchPlan.upserts, result, runContext);
      applyUserMediaPlanToMap(existingUserMedia, batchPlan);
      await insertMediaWatchActivity(user.id, batchPlan.watchActivityRows, result, runContext);
      await flushPendingPullItemFailures(runContext, result);
      showHistoryProcessed += batch.length;
      overallNewestShowWatchedAt = latestTimestamp(overallNewestShowWatchedAt, batchPlan.newestWatchedAt);

      // Save bootstrap cursor after each batch so a timeout is resumable.
      if (overallNewestShowWatchedAt) {
        await upsertSyncCursor(provider, showHistoryBootstrapCursorKey, overallNewestShowWatchedAt);
      }

      progressCurrent += 1;
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: progressCurrent,
        itemCurrent: showHistoryProcessed,
        itemLabel: "episodes",
        itemTotal: showHistoryStates.length,
        label: `Importing episode history (${showHistoryProcessed}/${showHistoryStates.length})`,
        phase: "reconcile",
        total: progressTotal,
      });
    }

    // Process watchlist + ratings with the final in-memory user_media state.
    const showPlan = planPullUserMediaWrites({
      episodeResolution,
      existingUserMedia,
      pendingMediaIds,
      removedRatingKeys: activeRemovedShowRatingKeys,
      removedWatchlistKeys: activeRemovedShowWatchlistKeys,
      result,
      showHistoryStates: [],
      showRatingStates: activeShowRatingStates,
      showResolution,
      showWatchlistStates: activeShowWatchlistStates,
    });

    await deleteUserMedia(user.id, showPlan.deleteMediaIds, result, runContext);
    await upsertUserMediaDrafts(user.id, showPlan.upserts, result, runContext);
    applyUserMediaPlanToMap(existingUserMedia, showPlan);
    await flushPendingPullItemFailures(runContext, result);
    await storeShowHistoryCheckpoint(runContext, {
      changed: showHistoryStates.length > 0,
      itemCount: showHistoryStates.length,
      newestWatchedAt: overallNewestShowWatchedAt ?? showHistoryCursor,
    });
    // Bootstrap complete — clear the intermediate cursor so future incremental
    // runs use showHistoryLastWatchedCursorKey exclusively.
    await upsertSyncCursor(provider, showHistoryBootstrapCursorKey, null);
    await storeSnapshotCheckpoint("shows.watchlist", runContext, {
      changed: showWatchlistChanged,
      itemCount: activeShowWatchlistStates.length + activeRemovedShowWatchlistKeys.length,
      snapshot: showWatchlistSnapshot,
    });
    await storeSnapshotCheckpoint("shows.ratings", runContext, {
      changed: showRatingsChanged,
      itemCount: activeShowRatingStates.length + activeRemovedShowRatingKeys.length,
      snapshot: showRatingSnapshot,
    });
    progressCurrent += 1;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: progressCurrent,
      itemCurrent: historyStates.length +
        activeWatchlistStates.length +
        activeRemovedWatchlistKeys.length +
        activeRatingStates.length +
        activeRemovedRatingKeys.length +
        showHistoryStates.length +
        activeShowWatchlistStates.length +
        activeRemovedShowWatchlistKeys.length +
        activeShowRatingStates.length +
        activeRemovedShowRatingKeys.length,
      itemLabel: "items",
      itemTotal: activeReconcileItemCount,
      label: "Show checkpoints saved",
      phase: "reconcile",
      total: progressTotal,
    });

    const tagsByListKey = await upsertTraktListTags(user.id, listStatesToTag, result, runContext);
    if (includeMovies) {
      await upsertTraktListMovieTags(
        user.id,
        listStatesToTag,
        tagsByListKey,
        movieResolution,
        result,
        runContext,
      );
    }
    await upsertTraktListMediaTags(
      user.id,
      listStatesToTag,
      tagsByListKey,
      showResolution,
      result,
      runContext,
    );
    await flushPendingPullItemFailures(runContext, result);
    await storeListSnapshots(listStates, runContext);
    let listProgressLabel = "No Trakt lists to import";

    if (listStates.length > 0 && changedListCount === 0) {
      listProgressLabel = "Trakt lists unchanged";
    } else if (result.listItemsTagged > 0) {
      listProgressLabel = `Imported ${result.listItemsTagged} new list tag link(s)`;
    } else if (changedListCount > 0) {
      listProgressLabel = "List snapshots updated; no new tag links";
    }

    progressCurrent += 1;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: progressCurrent,
      itemCurrent: activeReconcileItemCount,
      itemLabel: "items",
      itemTotal: activeReconcileItemCount,
      label: listProgressLabel,
      phase: "reconcile",
      total: progressTotal,
    });

    await assertTraktSyncRunActive(user.id, run.id);
    progressCurrent = Math.min(progressCurrent + reconcileBatchCount, progressTotal - 1);
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: progressCurrent,
      itemCurrent: activeReconcileItemCount,
      itemLabel: "items",
      itemTotal: activeReconcileItemCount,
      label: "Finalizing pull",
      phase: "reconcile",
      total: progressTotal,
    });

    const processedAt = new Date().toISOString();
    await flushPendingPullItemFailures(runContext, result);
    await upsertSyncCursor(provider, lastPullCursorKey, processedAt);
    await createSyncEvent({
      provider,
      direction: "pull",
      eventType: "trakt.pull.summary",
      status: result.failed > 0 ? "error" : "success",
      payload: result as unknown as Json,
      errorMessage: result.failed > 0 ? `${result.failed} Trakt pull item(s) failed.` : null,
      processedAt,
    });
    await finishTraktSyncRun(
      user.id,
      run.id,
      "success",
      {
        current: progressTotal,
        label: result.failed > 0 ? "Pull complete with item failures" : "Pull complete",
        phase: "complete",
        total: progressTotal,
      },
      result as unknown as Json,
      result.failed > 0 ? `${result.failed} item-level Trakt pull failure(s).` : null,
    );

    return result;
  } catch (error) {
    const cancelled = isSyncRunCancelledError(error);
    await finishTraktSyncRun(
      user.id,
      run.id,
      cancelled ? "cancelled" : "error",
      {
        current: progressCurrent,
        label: cancelled ? "Pull stopped" : "Pull failed",
        phase: cancelled ? "cancelled" : "error",
        total: progressTotal,
      },
      {},
      getErrorMessage(error),
    );
    throw error;
  }
}

export async function cancelActiveTraktSync() {
  const user = await requireUser();
  const cancelledAt = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .update({
      cancelled_at: cancelledAt,
      error_message: "Sync was stopped by the user.",
      finished_at: cancelledAt,
      label: "Sync stopped",
      phase: "cancelled",
      status: "cancelled",
    })
    .eq("user_id", user.id)
    .eq("provider", provider)
    .eq("status", "running")
    .select("*")
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to stop Trakt sync.", error);
  }

  return data;
}

export function isTraktSyncControlError(error: unknown) {
  return isAppError(error) && (
    error.code === "SYNC_ALREADY_RUNNING" ||
    error.code === "SYNC_CANCELLED"
  );
}

function isSyncRunCancelledError(error: unknown) {
  return isAppError(error) && error.code === "SYNC_CANCELLED";
}

async function createTraktSyncRun(
  userId: string,
  direction: SyncDirection,
  payload: SyncProgressPayload,
) {
  await markStaleTraktRuns(userId);

  const fields = toSyncRunFields(payload);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      user_id: userId,
      provider,
      direction,
      status: "running",
      ...fields,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("A Trakt sync is already running.", {
        cause: error,
        code: "SYNC_ALREADY_RUNNING",
        status: 409,
      });
    }

    throwDatabaseError("Failed to start Trakt sync run.", error);
  }

  return data;
}

async function updateTraktSyncRunProgress(
  userId: string,
  runId: string,
  payload: SyncProgressPayload,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .update(toSyncRunFields(payload))
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("status", "running")
    .select("*")
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to update Trakt sync run.", error);
  }

  if (!data) {
    await assertTraktSyncRunActive(userId, runId);
  }

  return data;
}

async function finishTraktSyncRun(
  userId: string,
  runId: string,
  status: SyncRunTerminalStatus,
  payload: SyncProgressPayload,
  summary: Json = {},
  errorMessage: string | null = null,
) {
  const timestamp = new Date().toISOString();
  const fields = toSyncRunFields(payload);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .update({
      ...fields,
      cancelled_at: status === "cancelled" ? timestamp : null,
      error_message: errorMessage,
      finished_at: timestamp,
      status,
      summary,
    })
    .eq("id", runId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to finish Trakt sync run.", error);
  }

  return data;
}

async function assertTraktSyncRunActive(userId: string, runId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .select("status")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to read Trakt sync run.", error);
  }

  if (data?.status === "cancelled") {
    throw new AppError("Sync was stopped by the user.", {
      code: "SYNC_CANCELLED",
      status: 409,
    });
  }

  if (data?.status !== "running") {
    throw new AppError("Sync run is no longer active.", {
      code: "SYNC_NOT_ACTIVE",
      status: 409,
    });
  }
}

async function markStaleTraktRuns(userId: string) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - activeSyncRunMaxAgeMs).toISOString();
  const { error } = await createSupabaseAdminClient()
    .from("sync_runs")
    .update({
      error_message: staleSyncMessage,
      finished_at: now.toISOString(),
      label: "Sync timed out",
      phase: "error",
      status: "error",
    })
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "running")
    .lt("updated_at", cutoff);

  if (error) {
    throwDatabaseError("Failed to mark stale Trakt sync runs.", error);
  }
}

function toSyncRunFields(payload: SyncProgressPayload) {
  const current = Math.max(Math.floor(payload.current), 0);
  const total = Math.max(Math.floor(payload.total), 0);
  const itemCurrent = payload.itemCurrent === null || payload.itemCurrent === undefined
    ? null
    : Math.max(Math.floor(payload.itemCurrent), 0);
  const itemTotal = payload.itemTotal === null || payload.itemTotal === undefined
    ? null
    : Math.max(Math.floor(payload.itemTotal), 0);

  return {
    current,
    item_current: itemCurrent,
    item_label: payload.itemLabel?.trim() || null,
    item_total: itemTotal,
    label: payload.label,
    phase: payload.phase,
    total,
  };
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
  );
}

function assertNever(value: never): never {
  throw new AppError(`Unsupported Trakt push operation: ${String(value)}`, {
    code: "UNSUPPORTED_SYNC_OPERATION",
    status: 400,
  });
}

function getPushSkipReason(event: SyncEvent) {
  return event.event_type === "movie.tag.add" || event.event_type === "movie.tag.remove"
    ? "Trakt does not expose app tag sync for movies."
    : null;
}

function getPushOperation(event: SyncEvent): PushOperation {
  const payload = readRecord(event.payload);

  switch (event.event_type) {
    case "movie.mark_watched":
    case "movie.add_watch_date":
      return "history.add";
    case "movie.add_to_watchlist":
      return "watchlist.add";
    case "movie.remove_from_watchlist":
      return "watchlist.remove";
    case "movie.remove_from_library":
      return "history.remove";
    case "movie.rating.set": {
      const personalRating = readNumber(payload.personalRating, "personalRating");

      if (personalRating < 1) {
        return "ratings.remove";
      }

      return "ratings.set";
    }
    case "movie.rating.clear":
      return "ratings.remove";
    case "show.add_to_watchlist":
      return "show.watchlist.add";
    case "show.remove_from_watchlist":
      return "show.watchlist.remove";
    case "show.rating.set": {
      const personalRating = readNumber(payload.personalRating, "personalRating");

      if (personalRating < 1) {
        return "show.ratings.remove";
      }

      return "show.ratings.set";
    }
    case "show.rating.clear":
      return "show.ratings.remove";
    case "episode.mark_watched":
    case "episode.add_watch_date":
      return "episode.history.add";
    case "episode.remove_from_history":
      return "episode.history.remove";
    default:
      throw new AppError(`Unsupported Trakt sync event: ${event.event_type}`, {
        code: "UNSUPPORTED_SYNC_EVENT",
        status: 400,
      });
  }
}

function takeAdjacentPushEvents(
  events: SyncEvent[],
  startIndex: number,
  operation: PushOperation,
) {
  const batch: SyncEvent[] = [];

  for (let index = startIndex; index < events.length; index += 1) {
    const event = events[index];

    if (getPushSkipReason(event)) {
      break;
    }

    try {
      if (getPushOperation(event) !== operation) {
        break;
      }
    } catch {
      break;
    }

    batch.push(event);
  }

  return batch;
}

async function preparePushEvent(
  event: SyncEvent,
  operation: PushOperation,
): Promise<PreparedPushEvent> {
  const payload = readRecord(event.payload);

  switch (operation) {
    case "history.add": {
      const movieId = readString(payload.movieId, "movieId");
      const { mappings, movie } = await loadMovieForPush(movieId);

      return {
        event,
        movie: toTraktHistoryMovie(
          movie,
          readString(payload.watchedAt, "watchedAt"),
          mappings,
        ),
        operation,
      };
    }
    case "ratings.set": {
      const movieId = readString(payload.movieId, "movieId");
      const { mappings, movie } = await loadMovieForPush(movieId);

      return {
        event,
        movie: toTraktRatedMovie(
          movie,
          Math.min(Math.max(Math.round(readNumber(payload.personalRating, "personalRating")), 1), 10),
          event.created_at,
          mappings,
        ),
        operation,
      };
    }
    case "history.remove":
    case "ratings.remove":
    case "watchlist.add":
    case "watchlist.remove": {
      const movieId = readString(payload.movieId, "movieId");
      const { mappings, movie } = await loadMovieForPush(movieId);

      return {
        event,
        movie: toTraktSyncMovie(movie, mappings),
        operation,
      };
    }
    case "show.ratings.set": {
      const showId = readString(payload.showId, "showId");
      const { mappings, show } = await loadShowForPush(showId);

      return {
        event,
        operation,
        show: toTraktRatedShow(
          show,
          Math.min(Math.max(Math.round(readNumber(payload.personalRating, "personalRating")), 1), 10),
          event.created_at,
          mappings,
        ),
      };
    }
    case "show.ratings.remove":
    case "show.watchlist.add":
    case "show.watchlist.remove": {
      const showId = readString(payload.showId, "showId");
      const { mappings, show } = await loadShowForPush(showId);

      return {
        event,
        operation,
        show: toTraktSyncShow(show, mappings),
      };
    }
    case "episode.history.add": {
      const episodeId = readString(payload.episodeId, "episodeId");
      const { episode, mappings } = await loadEpisodeForPush(episodeId);

      return {
        episode: toTraktHistoryEpisode(
          episode,
          readString(payload.watchedAt, "watchedAt"),
          mappings,
        ),
        event,
        operation,
      };
    }
    case "episode.history.remove": {
      const episodeId = readString(payload.episodeId, "episodeId");
      const { episode, mappings } = await loadEpisodeForPush(episodeId);
      const traktEpisode = toTraktHistoryEpisode(
        episode,
        event.created_at,
        mappings,
      );

      delete traktEpisode.watched_at;

      return {
        episode: traktEpisode,
        event,
        operation,
      };
    }
    default:
      return assertNever(operation);
  }
}

function pushPreparedBatch(auth: TraktAuth, batch: PreparedPushEvent[]) {
  const operation = batch[0]?.operation;

  switch (operation) {
    case "history.add":
      return addTraktHistory(auth, { movies: batch.flatMap((entry) => entry.movie ? [entry.movie] : []) });
    case "history.remove":
      return removeTraktHistory(auth, { movies: batch.flatMap((entry) => entry.movie ? [entry.movie] : []) });
    case "ratings.remove":
      return removeTraktRatings(auth, { movies: batch.flatMap((entry) => entry.movie ? [entry.movie] : []) });
    case "ratings.set":
      return setTraktRatings(auth, { movies: batch.flatMap((entry) => entry.movie ? [entry.movie] : []) });
    case "watchlist.add":
      return addTraktWatchlist(auth, { movies: batch.flatMap((entry) => entry.movie ? [entry.movie] : []) });
    case "watchlist.remove":
      return removeTraktWatchlist(auth, { movies: batch.flatMap((entry) => entry.movie ? [entry.movie] : []) });
    case "show.ratings.remove":
      return removeTraktRatings(auth, { shows: batch.flatMap((entry) => entry.show ? [entry.show] : []) });
    case "show.ratings.set":
      return setTraktRatings(auth, { shows: batch.flatMap((entry) => entry.show ? [entry.show] : []) });
    case "show.watchlist.add":
      return addTraktWatchlist(auth, { shows: batch.flatMap((entry) => entry.show ? [entry.show] : []) });
    case "show.watchlist.remove":
      return removeTraktWatchlist(auth, { shows: batch.flatMap((entry) => entry.show ? [entry.show] : []) });
    case "episode.history.add":
      return addTraktHistory(auth, { episodes: batch.flatMap((entry) => entry.episode ? [entry.episode] : []) });
    case "episode.history.remove":
      return removeTraktHistory(auth, { episodes: batch.flatMap((entry) => entry.episode ? [entry.episode] : []) });
    default:
      throw new AppError("Cannot push an empty Trakt sync batch.", {
        code: "INVALID_SYNC_BATCH",
        status: 400,
      });
  }
}

async function refreshTraktConnection(userId: string, auth: TraktAuth) {
  const settings = await getTraktUserSettings(auth);
  const providerUserId = settings.user?.ids?.slug ?? settings.user?.username ?? null;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("provider_connections")
    .update({
      provider_user_id: providerUserId,
      last_validated_at: new Date().toISOString(),
      status: "active",
    })
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) {
    throwDatabaseError("Failed to update Trakt connection state.", error);
  }
}

async function listAllHistory(
  auth: TraktAuth,
  startAt: string | null,
  run: SyncRunContext,
  onPage?: (count: number, total: number | null) => Promise<void>,
) {
  const items: TraktHistoryMovie[] = [];

  for (let page = 1; page <= maxBootstrapPages; page += 1) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const response = await listTraktHistoryMoviesPage(auth, {
      page,
      limit: pageLimit,
      startAt,
    });

    items.push(...response.items);
    await onPage?.(items.length, response.pagination.itemCount);
    await assertTraktSyncRunActive(run.userId, run.runId);

    if (!hasNextTraktPage(response.pagination, page, response.items.length)) {
      break;
    }
  }

  return items;
}

async function listAllShowHistory(
  auth: TraktAuth,
  startAt: string | null,
  run: SyncRunContext,
  onPage?: (count: number, total: number | null) => Promise<void>,
) {
  const items: TraktHistoryEpisode[] = [];

  for (let page = 1; page <= maxBootstrapPages; page += 1) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const response = await listTraktHistoryShowsPage(auth, {
      page,
      limit: pageLimit,
      startAt,
    });

    items.push(...response.items);
    await onPage?.(items.length, response.pagination.itemCount);
    await assertTraktSyncRunActive(run.userId, run.runId);

    if (!hasNextTraktPage(response.pagination, page, response.items.length)) {
      break;
    }
  }

  return items;
}

async function listAllWatchlist(
  auth: TraktAuth,
  run: SyncRunContext,
  onPage?: (count: number, total: number | null) => Promise<void>,
) {
  const items: TraktWatchlistMovie[] = [];

  for (let page = 1; page <= maxBootstrapPages; page += 1) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const response = await listTraktWatchlistMoviesPage(auth, {
      page,
      limit: pageLimit,
    });

    items.push(...response.items);
    await onPage?.(items.length, response.pagination.itemCount);
    await assertTraktSyncRunActive(run.userId, run.runId);

    if (!hasNextTraktPage(response.pagination, page, response.items.length)) {
      break;
    }
  }

  return items;
}

async function listAllShowWatchlist(
  auth: TraktAuth,
  run: SyncRunContext,
  onPage?: (count: number, total: number | null) => Promise<void>,
) {
  const items: TraktWatchlistShow[] = [];

  for (let page = 1; page <= maxBootstrapPages; page += 1) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const response = await listTraktWatchlistShowsPage(auth, {
      page,
      limit: pageLimit,
    });

    items.push(...response.items);
    await onPage?.(items.length, response.pagination.itemCount);
    await assertTraktSyncRunActive(run.userId, run.runId);

    if (!hasNextTraktPage(response.pagination, page, response.items.length)) {
      break;
    }
  }

  return items;
}

async function listAllRatings(
  auth: TraktAuth,
  run: SyncRunContext,
  onPage?: (count: number, total: number | null) => Promise<void>,
) {
  const items: TraktRatedMovie[] = [];

  for (let page = 1; page <= maxBootstrapPages; page += 1) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const response = await listTraktRatedMoviesPage(auth, {
      page,
      limit: pageLimit,
    });

    items.push(...response.items);
    await onPage?.(items.length, response.pagination.itemCount);
    await assertTraktSyncRunActive(run.userId, run.runId);

    if (!hasNextTraktPage(response.pagination, page, response.items.length)) {
      break;
    }
  }

  return items;
}

async function listAllShowRatings(
  auth: TraktAuth,
  run: SyncRunContext,
  onPage?: (count: number, total: number | null) => Promise<void>,
) {
  const items: TraktRatedShow[] = [];

  for (let page = 1; page <= maxBootstrapPages; page += 1) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const response = await listTraktRatedShowsPage(auth, {
      page,
      limit: pageLimit,
    });

    items.push(...response.items);
    await onPage?.(items.length, response.pagination.itemCount);
    await assertTraktSyncRunActive(run.userId, run.runId);

    if (!hasNextTraktPage(response.pagination, page, response.items.length)) {
      break;
    }
  }

  return items;
}

async function listAllListsWithTaggableItems(
  auth: TraktAuth,
  cursors: CursorMap,
  result: PullResult,
  run: SyncRunContext,
  options: { itemKinds?: TraktListItemKind[] } = {},
  onProgress?: (counts: TraktListFetchProgress) => Promise<void>,
): Promise<TraktListFetchResult> {
  const itemKinds = normalizeListItemKinds(options.itemKinds);
  const includeMovies = itemKinds.includes("movie");
  const includeShows = itemKinds.includes("show");
  const lists = await listAllUserLists(auth, run, async (listCount) => {
    await onProgress?.({
      itemCount: 0,
      listCount,
      skippedListCount: 0,
      totalItemCount: null,
    });
  });
  const imports: TraktListImport[] = [];
  let itemCount = 0;
  let skippedListCount = 0;
  const totalItemCount = sumTraktListItemCounts(lists);

  for (const list of lists) {
    await assertTraktSyncRunActive(run.userId, run.runId);

    const listKey = getTraktListKey(list);
    const tagName = normalizeImportedTagName(list.name);

    if (!listKey || !tagName) {
      continue;
    }

    const cursorKey = listCursorKey(listKey, itemKinds);
    const metadataCursor = serializeListMetadataCursor({
      itemKinds,
      itemCount: list.item_count,
      tagName,
      updatedAt: list.updated_at,
    });
    const previousSnapshot = cursors.get(snapshotCursorKey(`lists.${cursorKey}`));
    const previousMetadataCursor = cursors.get(listMetadataCursorKey(cursorKey));
    const canReuseSnapshot = canSkipListItemFetch({
      currentMetadataCursor: metadataCursor,
      hasStableMetadata: hasStableTraktListMetadata(list),
      previousItemSnapshot: previousSnapshot,
      previousMetadataCursor,
    });

    if (canReuseSnapshot) {
      skippedListCount += 1;
      imports.push({
        cursorKey,
        itemFetchComplete: true,
        itemFetchSkipped: true,
        listKey,
        metadataCursor,
        movieItems: [],
        previousMetadataCursor,
        previousSnapshot,
        showItems: [],
        tagName,
      });
      await onProgress?.({
        itemCount,
        listCount: imports.length,
        skippedListCount,
        totalItemCount,
      });
      continue;
    }

    let itemFetchComplete = true;
    let movieItems: TraktListMovie[] = [];
    let showItems: TraktListShow[] = [];

    if (includeMovies) {
      try {
        movieItems = await listAllListMovieItems(auth, listKey, run, async (count) => {
          await onProgress?.({
            itemCount: itemCount + count,
            listCount: imports.length + 1,
            skippedListCount,
            totalItemCount,
          });
        });
      } catch (error) {
        recordPullFailure(result, "list", listKey, error);
        await onProgress?.({
          itemCount,
          listCount: imports.length,
          skippedListCount,
          totalItemCount,
        });
        continue;
      }
    }

    if (includeShows) {
      try {
        showItems = await listAllListShowItems(auth, listKey, run, async (count) => {
          await onProgress?.({
            itemCount: itemCount + movieItems.length + count,
            listCount: imports.length + 1,
            skippedListCount,
            totalItemCount,
          });
        });
      } catch (error) {
        itemFetchComplete = false;
        recordPullFailure(result, "list", includeMovies ? `${listKey}:shows` : listKey, error);
      }
    }

    itemCount += movieItems.length + showItems.length;
    imports.push({
      cursorKey,
      itemFetchComplete,
      itemFetchSkipped: false,
      listKey,
      metadataCursor,
      movieItems,
      previousMetadataCursor,
      previousSnapshot,
      showItems,
      tagName,
    });
    await onProgress?.({
      itemCount,
      listCount: imports.length,
      skippedListCount,
      totalItemCount,
    });
  }

  return { imports, itemCount, skippedListCount, totalItemCount };
}

async function listAllUserLists(
  auth: TraktAuth,
  run: SyncRunContext,
  onPage?: (count: number) => Promise<void>,
) {
  const items: TraktUserList[] = [];

  for (let page = 1; page <= maxBootstrapPages; page += 1) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const response = await listTraktUserListsPage(auth, {
      page,
      limit: pageLimit,
    });

    items.push(...response.items);
    await onPage?.(items.length);
    await assertTraktSyncRunActive(run.userId, run.runId);

    if (!hasNextTraktPage(response.pagination, page, response.items.length)) {
      break;
    }
  }

  return items;
}

async function listAllListMovieItems(
  auth: TraktAuth,
  listId: string,
  run: SyncRunContext,
  onPage?: (count: number) => Promise<void>,
) {
  const items: TraktListMovie[] = [];

  for (let page = 1; page <= maxBootstrapPages; page += 1) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const response = await listTraktListMovieItemsPage(auth, {
      listId,
      page,
      limit: pageLimit,
    });

    items.push(...response.items);
    await onPage?.(items.length);
    await assertTraktSyncRunActive(run.userId, run.runId);

    if (!hasNextTraktPage(response.pagination, page, response.items.length)) {
      break;
    }
  }

  return items;
}

async function listAllListShowItems(
  auth: TraktAuth,
  listId: string,
  run: SyncRunContext,
  onPage?: (count: number) => Promise<void>,
) {
  const items: TraktListShow[] = [];

  for (let page = 1; page <= maxBootstrapPages; page += 1) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const response = await listTraktListShowItemsPage(auth, {
      listId,
      page,
      limit: pageLimit,
    });

    items.push(...response.items);
    await onPage?.(items.length);
    await assertTraktSyncRunActive(run.userId, run.runId);

    if (!hasNextTraktPage(response.pagination, page, response.items.length)) {
      break;
    }
  }

  return items;
}

function formatListFetchProgressLabel(counts: TraktListFetchProgress) {
  const skipped = counts.skippedListCount > 0
    ? `, skipped ${counts.skippedListCount} unchanged list(s)`
    : "";

  return `Loaded ${counts.itemCount} list item(s) across ${counts.listCount} list(s)${skipped}`;
}

function sumTraktListItemCounts(lists: TraktUserList[]) {
  let total = 0;

  for (const list of lists) {
    if (
      typeof list.item_count !== "number" ||
      !Number.isInteger(list.item_count) ||
      list.item_count < 0
    ) {
      return null;
    }

    total += list.item_count;
  }

  return total;
}

function hasStableTraktListMetadata(list: TraktUserList) {
  return typeof list.updated_at === "string" && list.updated_at.trim().length > 0;
}

function hasNextTraktPage(pagination: TraktPagination, page: number, itemCount: number) {
  if (pagination.pageCount) {
    return page < pagination.pageCount;
  }

  return itemCount >= (pagination.limit ?? pageLimit);
}

function normalizeHistoryStates(items: TraktHistoryMovie[], result: PullResult) {
  const states: RemoteHistoryState[] = [];

  for (const item of items) {
    const movie = toRemoteTraktMovieState(item.movie);

    if (!movie) {
      result.skipped += 1;
      continue;
    }

    states.push({ item, movie });
  }

  return states;
}

function normalizeShowHistoryStates(items: TraktHistoryEpisode[], result: PullResult) {
  const states: RemoteTraktEpisodeHistoryState[] = [];

  for (const item of items) {
    const state = toRemoteTraktEpisodeHistoryState(item);

    if (!state) {
      result.skipped += 1;
      continue;
    }

    states.push(state);
  }

  return states;
}

function normalizeWatchlistStates(items: TraktWatchlistMovie[], result: PullResult) {
  const states: RemoteTraktWatchlistState[] = [];

  for (const item of items) {
    const state = toRemoteTraktWatchlistState(item);

    if (!state) {
      result.skipped += 1;
      continue;
    }

    states.push(state);
  }

  return states;
}

function normalizeShowWatchlistStates(items: TraktWatchlistShow[], result: PullResult) {
  const states: RemoteTraktShowWatchlistState[] = [];

  for (const item of items) {
    const state = toRemoteTraktShowWatchlistState(item);

    if (!state) {
      result.skipped += 1;
      continue;
    }

    states.push(state);
  }

  return states;
}

function normalizeRatingStates(items: TraktRatedMovie[], result: PullResult) {
  const states: RemoteTraktRatingState[] = [];

  for (const item of items) {
    const state = toRemoteTraktRatingState(item);

    if (!state) {
      result.skipped += 1;
      continue;
    }

    states.push(state);
  }

  return states;
}

function normalizeShowRatingStates(items: TraktRatedShow[], result: PullResult) {
  const states: RemoteTraktShowRatingState[] = [];

  for (const item of items) {
    const state = toRemoteTraktShowRatingState(item);

    if (!state) {
      result.skipped += 1;
      continue;
    }

    states.push(state);
  }

  return states;
}

function normalizeListStates(
  imports: TraktListImport[],
  cursors: CursorMap,
  result: PullResult,
) {
  const states: RemoteTraktListState[] = [];

  for (const listImport of imports) {
    if (listImport.itemFetchSkipped) {
      states.push({
        changed: false,
        cursorKey: listImport.cursorKey,
        itemFetchComplete: true,
        itemFetchSkipped: true,
        listKey: listImport.listKey,
        metadataCursor: listImport.metadataCursor,
        movieStates: [],
        movieStatesToTag: [],
        removedKeys: [],
        showStates: [],
        showStatesToTag: [],
        snapshot: listImport.previousSnapshot ?? serializeStringSnapshot([]),
        tagName: listImport.tagName,
      });
      continue;
    }

    const movieStatesByKey = new Map<string, RemoteTraktMovieState>();
    const showStatesByKey = new Map<string, RemoteTraktShowState>();

    for (const item of listImport.movieItems) {
      if (item.type && item.type !== "movie") {
        continue;
      }

      const movie = toRemoteTraktMovieState(item.movie);

      if (!movie) {
        result.skipped += 1;
        continue;
      }

      if (!movieStatesByKey.has(movie.key)) {
        movieStatesByKey.set(movie.key, movie);
      }
    }

    for (const item of listImport.showItems) {
      if (item.type && item.type !== "show") {
        continue;
      }

      const show = toRemoteTraktShowState(item.show);

      if (!show) {
        result.skipped += 1;
        continue;
      }

      if (!showStatesByKey.has(show.key)) {
        showStatesByKey.set(show.key, show);
      }
    }

    const delta = getStringSnapshotDelta(
      [
        ...Array.from(movieStatesByKey.keys()).map((key) => `movie:${key}`),
        ...Array.from(showStatesByKey.keys()).map((key) => `show:${key}`),
      ],
      listImport.previousSnapshot ?? cursors.get(snapshotCursorKey(`lists.${listImport.cursorKey}`)),
    );
    const movieStatesToTag: RemoteTraktMovieState[] = Array.from(movieStatesByKey.values());
    const showStatesToTag: RemoteTraktShowState[] = Array.from(showStatesByKey.values());

    states.push({
      changed: delta.changed,
      cursorKey: listImport.cursorKey,
      itemFetchComplete: listImport.itemFetchComplete,
      itemFetchSkipped: false,
      listKey: listImport.listKey,
      metadataCursor: listImport.metadataCursor,
      movieStates: Array.from(movieStatesByKey.values()),
      movieStatesToTag,
      removedKeys: delta.removedKeys,
      showStates: Array.from(showStatesByKey.values()),
      showStatesToTag,
      snapshot: delta.snapshot,
      tagName: listImport.tagName,
    });
  }

  result.listsImported = states.filter(
    (list) => list.movieStatesToTag.length > 0 || list.showStatesToTag.length > 0,
  ).length;

  return states;
}

function normalizeListItemKinds(itemKinds: TraktListItemKind[] | undefined) {
  const normalized = new Set<TraktListItemKind>(itemKinds ?? ["movie", "show"]);

  if (normalized.size === 0) {
    normalized.add("movie");
    normalized.add("show");
  }

  return Array.from(normalized).sort((left, right) => left.localeCompare(right));
}

function listCursorKey(listKey: string, itemKinds: TraktListItemKind[]) {
  return itemKinds.length === 1 ? `${listKey}.${itemKinds[0]}s` : listKey;
}

async function resolveRemoteMovies({
  remoteKeys,
  remoteMovies,
  result,
  run,
}: {
  remoteKeys: string[];
  remoteMovies: RemoteTraktMovieState[];
  result: PullResult;
  run: SyncRunContext;
}): Promise<MovieResolutionResult> {
  const remoteMoviesByKey = new Map<string, RemoteTraktMovieState>();

  for (const movie of remoteMovies) {
    if (!remoteMoviesByKey.has(movie.key)) {
      remoteMoviesByKey.set(movie.key, movie);
    }
  }

  const mappings = await loadMediaProviderMappingMap(
    Array.from(remoteMoviesByKey.values()),
    remoteKeys,
    "movie",
    run,
  );
  const mediaIds = new Set(
    Array.from(mappings.values()).flatMap((mapping) => mapping.media_id ? [mapping.media_id] : []),
  );
  const moviesById = await loadMediaItemMapByIds(mediaIds, run);
  const movieIdByRemoteKey = new Map<string, string>();
  const failedRemoteKeys = new Map<string, string>();
  const unknownMovies: RemoteTraktMovieState[] = [];

  for (const key of remoteKeys) {
    const candidate = parseRemoteKey(key);
    const mediaId = candidate
      ? mappings.get(candidateMapKey(candidate))?.media_id
      : null;

    if (mediaId && moviesById.has(mediaId)) {
      movieIdByRemoteKey.set(key, mediaId);
    }
  }

  for (const movie of remoteMoviesByKey.values()) {
    const mappedItem = findMappedMediaItem(movie, mappings, moviesById);

    if (mappedItem) {
      movieIdByRemoteKey.set(movie.key, mappedItem.id);
      continue;
    }

    if (movie.tmdbId && !unknownMovies.some((m) => m.tmdbId === movie.tmdbId)) {
      unknownMovies.push(movie);
    }
  }

  const insertedMoviesByTmdb = await upsertMinimalTraktMovies(unknownMovies, result, run);

  for (const movie of remoteMoviesByKey.values()) {
    if (movieIdByRemoteKey.has(movie.key)) {
      continue;
    }

    const insertedMovie = movie.tmdbId ? insertedMoviesByTmdb.get(movie.tmdbId) : null;

    if (insertedMovie) {
      movieIdByRemoteKey.set(movie.key, insertedMovie.id);
    } else if (movie.tmdbId && unknownMovies.some((m) => m.tmdbId === movie.tmdbId)) {
      failedRemoteKeys.set(movie.key, `Failed to create TMDB ${movie.tmdbId}.`);
    }
  }

  return {
    failedRemoteKeys,
    movieIdByRemoteKey,
    remoteMoviesByKey,
  };
}


async function upsertMinimalTraktMovies(
  remoteMovies: RemoteTraktMovieState[],
  result: PullResult,
  run: SyncRunContext,
) {
  const mediaByTmdb = new Map<number, MediaItem>();
  const moviesWithTmdb = remoteMovies.filter(
    (movie): movie is RemoteTraktMovieState & { tmdbId: number } => movie.tmdbId !== null,
  );
  const rows: MediaItemInsert[] = moviesWithTmdb.map((movie) => ({
    metadata_updated_at: new Date().toISOString(),
    release_year: movie.year,
    title: movie.title?.trim() || `TMDB ${movie.tmdbId}`,
    type: "movie" as const,
  }));
  const supabase = createSupabaseAdminClient();

  for (const [chunkIndex, rowChunk] of chunkArray(rows, dbWriteChunkSize).entries()) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase.from("media_items").insert(rowChunk).select("*");

    if (error) {
      recordPullFailure(result, "metadata", "minimal-movies", error);
      continue;
    }

    data?.forEach((item, index) => {
      const remoteMovie = moviesWithTmdb[(chunkIndex * dbWriteChunkSize) + index];

      if (remoteMovie) {
        mediaByTmdb.set(remoteMovie.tmdbId, item as MediaItem);
      }
    });
  }

  const mappingRows: MediaProviderMappingInsert[] = [];

  for (const [tmdbId, item] of mediaByTmdb.entries()) {
    const remoteMovie = moviesWithTmdb.find((m) => m.tmdbId === tmdbId);

    if (!remoteMovie) {
      continue;
    }

    mappingRows.push({
      episode_id: null,
      media_id: item.id,
      provider: "tmdb",
      provider_id: String(tmdbId),
      provider_media_type: "movie",
    });

    if (remoteMovie.imdbId) {
      mappingRows.push({
        episode_id: null,
        media_id: item.id,
        provider: "imdb",
        provider_id: remoteMovie.imdbId,
        provider_media_type: "movie",
      });
    }

    if (remoteMovie.traktId) {
      mappingRows.push({
        episode_id: null,
        media_id: item.id,
        provider: "trakt",
        provider_id: remoteMovie.traktId,
        provider_media_type: "movie",
      });
    }
  }

  for (const rowChunk of chunkArray(mappingRows, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("media_provider_mappings")
      .upsert(rowChunk, { onConflict: "provider,provider_media_type,provider_id" });

    if (error) {
      recordPullFailure(result, "mapping", "minimal-movie-mappings", error);
    }
  }

  return mediaByTmdb;
}

async function upsertResolvedMovieProviderMappings(
  resolution: MovieResolutionResult,
  result: PullResult,
  run: SyncRunContext,
) {
  const rows: MediaProviderMappingInsert[] = [];

  for (const movie of resolution.remoteMoviesByKey.values()) {
    const mediaId = resolution.movieIdByRemoteKey.get(movie.key);

    if (!mediaId) {
      continue;
    }

    for (const candidate of providerCandidates(movie)) {
      rows.push({
        episode_id: null,
        media_id: mediaId,
        provider: candidate.provider,
        provider_id: candidate.id,
        provider_media_type: "movie",
      });
    }
  }

  await upsertMediaProviderMappings(rows, result, run);
}

async function resolveRemoteShows({
  remoteKeys,
  remoteShows,
  result,
  run,
}: {
  remoteKeys: string[];
  remoteShows: RemoteTraktShowState[];
  result: PullResult;
  run: SyncRunContext;
}): Promise<ShowResolutionResult> {
  const remoteShowsByKey = new Map<string, RemoteTraktShowState>();

  for (const show of remoteShows) {
    if (!remoteShowsByKey.has(show.key)) {
      remoteShowsByKey.set(show.key, show);
    }
  }

  const mappings = await loadMediaProviderMappingMap(
    Array.from(remoteShowsByKey.values()),
    remoteKeys,
    "show",
    run,
  );
  const mediaIds = new Set(
    Array.from(mappings.values()).flatMap((mapping) => mapping.media_id ? [mapping.media_id] : []),
  );
  const showsById = await loadMediaItemMapByIds(mediaIds, run);
  const mediaIdByRemoteKey = new Map<string, string>();
  const failedRemoteKeys = new Map<string, string>();
  const unknownShows: RemoteTraktShowState[] = [];

  for (const key of remoteKeys) {
    const candidate = parseRemoteKey(key);
    const mediaId = candidate
      ? mappings.get(candidateMapKey(candidate))?.media_id
      : null;

    if (mediaId && showsById.has(mediaId)) {
      mediaIdByRemoteKey.set(key, mediaId);
    }
  }

  for (const show of remoteShowsByKey.values()) {
    const mappedShow = findMappedMediaItem(show, mappings, showsById);

    if (mappedShow) {
      mediaIdByRemoteKey.set(show.key, mappedShow.id);
      continue;
    }

    unknownShows.push(show);
  }

  const insertedShows = await upsertMinimalTraktShows(unknownShows, result, run);

  for (const show of remoteShowsByKey.values()) {
    if (mediaIdByRemoteKey.has(show.key)) {
      continue;
    }

    const insertedShow = insertedShows.get(show.key);

    if (insertedShow) {
      mediaIdByRemoteKey.set(show.key, insertedShow.id);
    } else {
      failedRemoteKeys.set(show.key, `Failed to create show ${show.key}.`);
    }
  }

  return {
    failedRemoteKeys,
    mediaIdByRemoteKey,
    remoteShowsByKey,
  };
}

async function resolveRemoteEpisodes({
  historyStates,
  result,
  run,
  showResolution,
}: {
  historyStates: RemoteTraktEpisodeHistoryState[];
  result: PullResult;
  run: SyncRunContext;
  showResolution: ShowResolutionResult;
}): Promise<EpisodeResolutionResult> {
  const remoteEpisodesByKey = new Map<string, RemoteTraktEpisodeState>();

  for (const state of historyStates) {
    if (!remoteEpisodesByKey.has(state.episode.key)) {
      remoteEpisodesByKey.set(state.episode.key, state.episode);
    }
  }

  const mappings = await loadEpisodeProviderMappingMap(
    Array.from(remoteEpisodesByKey.values()),
    run,
  );
  const episodeIds = new Set(
    Array.from(mappings.values()).flatMap((mapping) => mapping.episode_id ? [mapping.episode_id] : []),
  );
  const episodesById = await loadEpisodeMapByIds(episodeIds, run);
  const existingByShowSeasonEpisode = await loadEpisodeMapByShowSeasonEpisode(
    historyStates,
    showResolution,
    run,
  );
  const episodeIdByRemoteKey = new Map<string, string>();
  const failedRemoteKeys = new Map<string, string>();

  for (const state of historyStates) {
    const mappedEpisodeId = findMappedEpisodeId(state.episode, mappings, episodesById);

    if (mappedEpisodeId) {
      episodeIdByRemoteKey.set(state.episode.key, mappedEpisodeId);
      continue;
    }

    const showId = showResolution.mediaIdByRemoteKey.get(state.show.key);
    const existingEpisode = showId
      ? existingByShowSeasonEpisode.get(showSeasonEpisodeKey(
          showId,
          state.episode.seasonNumber,
          state.episode.episodeNumber,
        ))
      : null;

    if (existingEpisode) {
      episodeIdByRemoteKey.set(state.episode.key, existingEpisode.id);
    }
  }

  const missingStates = historyStates.filter((state) => !episodeIdByRemoteKey.has(state.episode.key));
  const insertedEpisodes = await upsertMinimalTraktEpisodes(
    missingStates,
    showResolution,
    result,
    run,
  );

  for (const state of historyStates) {
    if (episodeIdByRemoteKey.has(state.episode.key)) {
      continue;
    }

    const insertedEpisode = insertedEpisodes.get(state.episode.key);

    if (insertedEpisode) {
      episodeIdByRemoteKey.set(state.episode.key, insertedEpisode.id);
    } else {
      failedRemoteKeys.set(state.episode.key, `Failed to create episode ${state.episode.key}.`);
    }
  }

  await upsertResolvedEpisodeProviderMappings(
    { episodeIdByRemoteKey, failedRemoteKeys, remoteEpisodesByKey },
    result,
    run,
  );

  return {
    episodeIdByRemoteKey,
    failedRemoteKeys,
    remoteEpisodesByKey,
  };
}

async function loadMediaProviderMappingMap(
  remoteItems: (RemoteTraktMovieState | RemoteTraktShowState)[],
  remoteKeys: string[],
  providerMediaType: "movie" | "show",
  run: SyncRunContext,
) {
  const candidates = new Map<string, ProviderCandidate>();

  for (const show of remoteItems) {
    for (const candidate of providerCandidates(show)) {
      candidates.set(candidateMapKey(candidate), candidate);
    }
  }

  for (const key of remoteKeys) {
    const candidate = parseRemoteKey(key);

    if (candidate) {
      candidates.set(candidateMapKey(candidate), candidate);
    }
  }

  const mappings = new Map<string, MediaProviderMapping>();
  const supabase = createSupabaseAdminClient();

  for (const [providerName, ids] of idsByProvider(candidates.values()).entries()) {
    for (const idChunk of chunkArray(Array.from(ids), dbReadChunkSize)) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { data, error } = await supabase
        .from("media_provider_mappings")
        .select("*")
        .eq("provider", providerName)
        .eq("provider_media_type", providerMediaType)
        .in("provider_id", idChunk);

      if (error) {
        throwDatabaseError("Failed to bulk load show provider mappings.", error);
      }

      for (const mapping of data ?? []) {
        mappings.set(
          candidateMapKey({ id: mapping.provider_id, provider: mapping.provider }),
          mapping as MediaProviderMapping,
        );
      }
    }
  }

  return mappings;
}

async function loadEpisodeProviderMappingMap(
  remoteEpisodes: RemoteTraktEpisodeState[],
  run: SyncRunContext,
) {
  const candidates = new Map<string, ProviderCandidate>();

  for (const episode of remoteEpisodes) {
    for (const candidate of providerCandidates(episode)) {
      candidates.set(candidateMapKey(candidate), candidate);
    }
  }

  const mappings = new Map<string, MediaProviderMapping>();
  const supabase = createSupabaseAdminClient();

  for (const [providerName, ids] of idsByProvider(candidates.values()).entries()) {
    for (const idChunk of chunkArray(Array.from(ids), dbReadChunkSize)) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { data, error } = await supabase
        .from("media_provider_mappings")
        .select("*")
        .eq("provider", providerName)
        .eq("provider_media_type", "episode")
        .in("provider_id", idChunk);

      if (error) {
        throwDatabaseError("Failed to bulk load episode provider mappings.", error);
      }

      for (const mapping of data ?? []) {
        mappings.set(
          candidateMapKey({ id: mapping.provider_id, provider: mapping.provider }),
          mapping as MediaProviderMapping,
        );
      }
    }
  }

  return mappings;
}

async function loadMediaItemMapByIds(ids: Iterable<string>, run: SyncRunContext) {
  const media = new Map<string, MediaItem>();
  const supabase = createSupabaseAdminClient();

  for (const idChunk of chunkArray(uniqueArray(ids), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase.from("media_items").select("*").in("id", idChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load media items.", error);
    }

    for (const item of data ?? []) {
      media.set(item.id, item as MediaItem);
    }
  }

  return media;
}

async function loadEpisodeMapByIds(ids: Iterable<string>, run: SyncRunContext) {
  const episodes = new Map<string, Episode>();
  const supabase = createSupabaseAdminClient();

  for (const idChunk of chunkArray(uniqueArray(ids), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase.from("episodes").select("*").in("id", idChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load episodes.", error);
    }

    for (const episode of data ?? []) {
      episodes.set(episode.id, episode as Episode);
    }
  }

  return episodes;
}

async function loadEpisodeMapByShowSeasonEpisode(
  historyStates: RemoteTraktEpisodeHistoryState[],
  showResolution: ShowResolutionResult,
  run: SyncRunContext,
) {
  const episodes = new Map<string, Episode>();
  const supabase = createSupabaseAdminClient();
  const showIds = uniqueArray(
    historyStates.flatMap((state) => {
      const showId = showResolution.mediaIdByRemoteKey.get(state.show.key);
      return showId ? [showId] : [];
    }),
  );

  for (const showIdChunk of chunkArray(showIds, dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase
      .from("episodes")
      .select("*")
      .in("show_id", showIdChunk);

    if (error) {
      throwDatabaseError("Failed to load show episodes.", error);
    }

    for (const episode of data ?? []) {
      episodes.set(
        showSeasonEpisodeKey(showIdChunk.find((id) => id === episode.show_id) ?? episode.show_id, episode.season_number, episode.episode_number),
        episode as Episode,
      );
    }
  }

  return episodes;
}

async function upsertMinimalTraktShows(
  remoteShows: RemoteTraktShowState[],
  result: PullResult,
  run: SyncRunContext,
) {
  const shows = new Map<string, MediaItem>();
  const supabase = createSupabaseAdminClient();
  const rows = remoteShows.map((show) => ({
    first_air_date: show.year ? `${show.year}-01-01` : null,
    metadata_updated_at: new Date().toISOString(),
    title: show.title?.trim() || (show.tmdbId ? `TMDB Show ${show.tmdbId}` : `Trakt Show ${show.traktId}`),
    tmdb_enriched_at: null,
    type: "show" as const,
  }));

  for (const [chunkIndex, rowChunk] of chunkArray(rows, dbWriteChunkSize).entries()) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase.from("media_items").insert(rowChunk).select("*");

    if (error) {
      recordPullFailure(result, "metadata", "minimal-shows", error);
      continue;
    }

    data?.forEach((show, index) => {
      const remoteShow = remoteShows[(chunkIndex * dbWriteChunkSize) + index];

      if (remoteShow) {
        shows.set(remoteShow.key, show as MediaItem);
      }
    });
  }

  return shows;
}

async function upsertMinimalTraktEpisodes(
  historyStates: RemoteTraktEpisodeHistoryState[],
  showResolution: ShowResolutionResult,
  result: PullResult,
  run: SyncRunContext,
) {
  const episodes = new Map<string, Episode>();
  const supabase = createSupabaseAdminClient();
  const rowsByRemoteKey = new Map<string, {
    key: string;
    row: {
      episode_number: number;
      metadata_updated_at: string;
      season_number: number;
      show_id: string;
      title: string;
    };
  }>();

  for (const state of historyStates) {
    const showId = showResolution.mediaIdByRemoteKey.get(state.show.key);

    if (!showId) {
      continue;
    }

    const key = showSeasonEpisodeKey(
      showId,
      state.episode.seasonNumber,
      state.episode.episodeNumber,
    );

    if (rowsByRemoteKey.has(key)) {
      continue;
    }

    rowsByRemoteKey.set(key, {
      key: state.episode.key,
      row: {
        episode_number: state.episode.episodeNumber,
        metadata_updated_at: new Date().toISOString(),
        season_number: state.episode.seasonNumber,
        show_id: showId,
        title: state.episode.title?.trim() ||
          `S${state.episode.seasonNumber}E${state.episode.episodeNumber}`,
      },
    });
  }

  for (const rowChunk of chunkArray(Array.from(rowsByRemoteKey.values()), dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase
      .from("episodes")
      .upsert(rowChunk.map((entry) => entry.row), { onConflict: "show_id,season_number,episode_number" })
      .select("*");

    if (error) {
      recordPullFailure(result, "episode", "minimal-episodes", error);
      continue;
    }

    for (const episode of data ?? []) {
      const match = rowChunk.find((entry) =>
        entry.row.show_id === episode.show_id &&
        entry.row.season_number === episode.season_number &&
        entry.row.episode_number === episode.episode_number
      );

      if (match) {
        episodes.set(match.key, episode as Episode);
      }
    }
  }

  return episodes;
}

async function upsertResolvedShowProviderMappings(
  resolution: ShowResolutionResult,
  result: PullResult,
  run: SyncRunContext,
) {
  const rows: MediaProviderMappingInsert[] = [];

  for (const show of resolution.remoteShowsByKey.values()) {
    const mediaId = resolution.mediaIdByRemoteKey.get(show.key);

    if (!mediaId) {
      continue;
    }

    for (const candidate of providerCandidates(show)) {
      rows.push({
        episode_id: null,
        media_id: mediaId,
        provider: candidate.provider,
        provider_id: candidate.id,
        provider_media_type: "show",
      });
    }
  }

  await upsertMediaProviderMappings(rows, result, run);
}

async function upsertResolvedEpisodeProviderMappings(
  resolution: EpisodeResolutionResult,
  result: PullResult,
  run: SyncRunContext,
) {
  const rows: MediaProviderMappingInsert[] = [];

  for (const episode of resolution.remoteEpisodesByKey.values()) {
    const episodeId = resolution.episodeIdByRemoteKey.get(episode.key);

    if (!episodeId) {
      continue;
    }

    for (const candidate of providerCandidates(episode)) {
      rows.push({
        episode_id: episodeId,
        media_id: null,
        provider: candidate.provider,
        provider_id: candidate.id,
        provider_media_type: "episode",
      });
    }
  }

  await upsertMediaProviderMappings(rows, result, run);
}

async function upsertMediaProviderMappings(
  rows: MediaProviderMappingInsert[],
  result: PullResult,
  run: SyncRunContext,
) {
  const supabase = createSupabaseAdminClient();

  for (const [providerName, mediaIds] of entityIdsByProvider(rows, "media_id").entries()) {
    for (const mediaIdChunk of chunkArray(Array.from(mediaIds), dbWriteChunkSize)) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error } = await supabase
        .from("media_provider_mappings")
        .delete()
        .eq("provider", providerName)
        .in("media_id", mediaIdChunk);

      if (error) {
        recordPullFailure(result, "mapping", "media-provider-replacement", error);
      }
    }
  }

  for (const [providerName, episodeIds] of entityIdsByProvider(rows, "episode_id").entries()) {
    for (const episodeIdChunk of chunkArray(Array.from(episodeIds), dbWriteChunkSize)) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error } = await supabase
        .from("media_provider_mappings")
        .delete()
        .eq("provider", providerName)
        .in("episode_id", episodeIdChunk);

      if (error) {
        recordPullFailure(result, "mapping", "episode-provider-replacement", error);
      }
    }
  }

  for (const rowChunk of chunkArray(rows, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("media_provider_mappings")
      .upsert(rowChunk, { onConflict: "provider,provider_media_type,provider_id" });

    if (error) {
      recordPullFailure(result, "mapping", "media-provider-mappings", error);
    }
  }
}

function findMappedMediaItem(
  remoteShow: RemoteTraktShowState,
  mappings: Map<string, MediaProviderMapping>,
  showsById: Map<string, MediaItem>,
) {
  for (const candidate of providerCandidates(remoteShow)) {
    const mediaId = mappings.get(candidateMapKey(candidate))?.media_id;

    if (mediaId) {
      const show = showsById.get(mediaId);

      if (show) {
        return show;
      }
    }
  }

  return null;
}

function findMappedEpisodeId(
  remoteEpisode: RemoteTraktEpisodeState,
  mappings: Map<string, MediaProviderMapping>,
  episodesById: Map<string, Episode>,
) {
  for (const candidate of providerCandidates(remoteEpisode)) {
    const episodeId = mappings.get(candidateMapKey(candidate))?.episode_id;

    if (episodeId && episodesById.has(episodeId)) {
      return episodeId;
    }
  }

  return null;
}

function showSeasonEpisodeKey(showId: string, seasonNumber: number, episodeNumber: number) {
  return `${showId}:${seasonNumber}:${episodeNumber}`;
}

async function loadUserMovieMap(
  userId: string,
  movieIds: Iterable<string>,
  run: SyncRunContext,
) {
  const userMovies = new Map<string, UserMediaDraft>();
  const supabase = createSupabaseAdminClient();

  for (const mediaIdChunk of chunkArray(uniqueArray(movieIds), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase
      .from("user_media")
      .select("*")
      .eq("user_id", userId)
      .in("media_id", mediaIdChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load user movie state.", error);
    }

    for (const row of data ?? []) {
      userMovies.set(row.media_id, draftFromUserMedia(row));
    }
  }

  return userMovies;
}

function planPullUserMovieWrites({
  existingUserMovies,
  historyStates,
  movieResolution,
  pendingMovieIds,
  ratingStates,
  removedRatingKeys,
  removedWatchlistKeys,
  result,
  watchlistStates,
}: {
  existingUserMovies: Map<string, UserMediaDraft>;
  historyStates: RemoteHistoryState[];
  movieResolution: MovieResolutionResult;
  pendingMovieIds: Set<string>;
  ratingStates: RemoteTraktRatingState[];
  removedRatingKeys: string[];
  removedWatchlistKeys: string[];
  result: PullResult;
  watchlistStates: RemoteTraktWatchlistState[];
}) {
  const drafts = new Map<string, UserMediaDraft>();
  const deletedMediaIds = new Set<string>();
  const watchActivityRows = new Map<string, MediaWatchActivityInsert>();
  let newestWatchedAt: string | null = null;

  function readDraft(mediaId: string): UserMediaDraft | null {
    if (drafts.has(mediaId)) {
      return drafts.get(mediaId) ?? null;
    }

    if (deletedMediaIds.has(mediaId)) {
      return null;
    }

    return existingUserMovies.get(mediaId) ?? null;
  }

  function writeDraft(draft: UserMediaDraft) {
    deletedMediaIds.delete(draft.mediaId);
    drafts.set(draft.mediaId, draft);
  }

  for (const state of historyStates) {
    const mediaId = resolveImportedMovieId(state.movie, movieResolution, result, "history");

    if (!mediaId) {
      continue;
    }

    const existingDraft = readDraft(mediaId);

    writeDraft({
      completedAt: existingDraft?.completedAt ?? null,
      completionMode: existingDraft?.completionMode ?? null,
      lastWatchedAt: latestTimestamp(existingDraft?.lastWatchedAt, state.item.watched_at),
      mediaId,
      personalRating: existingDraft?.personalRating ?? null,
      status: "done",
      watchlistedAt: null,
    });
    newestWatchedAt = latestTimestamp(newestWatchedAt, state.item.watched_at);
    watchActivityRows.set(`trakt:history:${state.item.id}`, {
      episode_id: null,
      media_id: mediaId,
      provider_event_id: `trakt:history:${state.item.id}`,
      source: "trakt_sync",
      user_id: "",
      watched_at: state.item.watched_at,
    });
    result.historyImported += 1;
  }

  for (const state of watchlistStates) {
    const mediaId = resolveImportedMovieId(state, movieResolution, result, "watchlist");

    if (!mediaId) {
      continue;
    }

    const existingDraft = readDraft(mediaId);

    if (existingDraft?.status === "done") {
      continue;
    }

    writeDraft({
      completedAt: null,
      completionMode: null,
      lastWatchedAt: null,
      mediaId,
      personalRating: existingDraft?.personalRating ?? null,
      status: "wishlist",
      watchlistedAt: state.listedAt,
    });
    result.watchlistImported += 1;
  }

  for (const key of removedWatchlistKeys) {
    const mediaId = movieResolution.movieIdByRemoteKey.get(key);

    if (!mediaId || pendingMovieIds.has(mediaId)) {
      continue;
    }

    const existingDraft = readDraft(mediaId);

    if (existingDraft?.status !== "wishlist") {
      continue;
    }

    drafts.delete(mediaId);
    deletedMediaIds.add(mediaId);
    result.watchlistRemoved += 1;
  }

  for (const state of ratingStates) {
    const mediaId = resolveImportedMovieId(state, movieResolution, result, "rating");

    if (!mediaId) {
      continue;
    }

    const existingDraft = readDraft(mediaId);

    writeDraft({
      completedAt: existingDraft?.completedAt ?? null,
      completionMode: existingDraft?.completionMode ?? null,
      lastWatchedAt: existingDraft?.lastWatchedAt ?? null,
      mediaId,
      personalRating: state.rating,
      status: existingDraft?.status ?? "done",
      watchlistedAt: existingDraft?.watchlistedAt ?? null,
    });
    result.ratingsImported += 1;
  }

  for (const key of removedRatingKeys) {
    const mediaId = movieResolution.movieIdByRemoteKey.get(key);

    if (!mediaId || pendingMovieIds.has(mediaId)) {
      continue;
    }

    const existingDraft = readDraft(mediaId);

    if (!existingDraft || existingDraft.personalRating === null) {
      continue;
    }

    writeDraft({
      ...existingDraft,
      personalRating: null,
    });
    result.ratingsCleared += 1;
  }

  return {
    deleteMediaIds: Array.from(deletedMediaIds),
    newestWatchedAt,
    upserts: Array.from(drafts.values()),
    watchActivityRows: Array.from(watchActivityRows.values()),
  };
}

function applyUserMoviePlanToMap(
  userMovies: Map<string, UserMediaDraft>,
  plan: { deleteMediaIds: string[]; upserts: UserMediaDraft[] },
) {
  for (const mediaId of plan.deleteMediaIds) {
    userMovies.delete(mediaId);
  }

  for (const draft of plan.upserts) {
    userMovies.set(draft.mediaId, draft);
  }
}

async function loadUserMediaMap(
  userId: string,
  mediaIds: Iterable<string>,
  run: SyncRunContext,
) {
  const userMedia = new Map<string, UserMediaDraft>();
  const supabase = createSupabaseAdminClient();

  for (const mediaIdChunk of chunkArray(uniqueArray(mediaIds), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase
      .from("user_media")
      .select("*")
      .eq("user_id", userId)
      .in("media_id", mediaIdChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load user media state.", error);
    }

    for (const row of data ?? []) {
      userMedia.set(row.media_id, draftFromUserMedia(row));
    }
  }

  return userMedia;
}

function planPullUserMediaWrites({
  episodeResolution,
  existingUserMedia,
  pendingMediaIds,
  removedRatingKeys,
  removedWatchlistKeys,
  result,
  showHistoryStates,
  showRatingStates,
  showResolution,
  showWatchlistStates,
}: {
  episodeResolution: EpisodeResolutionResult;
  existingUserMedia: Map<string, UserMediaDraft>;
  pendingMediaIds: Set<string>;
  removedRatingKeys: string[];
  removedWatchlistKeys: string[];
  result: PullResult;
  showHistoryStates: RemoteTraktEpisodeHistoryState[];
  showRatingStates: RemoteTraktShowRatingState[];
  showResolution: ShowResolutionResult;
  showWatchlistStates: RemoteTraktShowWatchlistState[];
}) {
  const drafts = new Map<string, UserMediaDraft>();
  const deletedMediaIds = new Set<string>();
  const watchActivityRows = new Map<string, MediaWatchActivityInsert>();
  let newestWatchedAt: string | null = null;

  function readDraft(mediaId: string): UserMediaDraft | null {
    if (drafts.has(mediaId)) {
      return drafts.get(mediaId) ?? null;
    }

    if (deletedMediaIds.has(mediaId)) {
      return null;
    }

    return existingUserMedia.get(mediaId) ?? null;
  }

  function writeDraft(draft: UserMediaDraft) {
    deletedMediaIds.delete(draft.mediaId);
    drafts.set(draft.mediaId, draft);
  }

  for (const state of showHistoryStates) {
    const mediaId = resolveImportedShowId(state.show, showResolution, result, "history");
    const episodeId = resolveImportedEpisodeId(state.episode, episodeResolution, result, "episode");

    if (!mediaId || !episodeId) {
      continue;
    }

    const existingDraft = readDraft(mediaId);
    const watchedAt = state.item.watched_at;

    writeDraft({
      completedAt: existingDraft?.completedAt ?? null,
      completionMode: existingDraft?.completionMode ?? null,
      lastWatchedAt: latestTimestamp(existingDraft?.lastWatchedAt, watchedAt),
      mediaId,
      personalRating: existingDraft?.personalRating ?? null,
      status: existingDraft?.status === "done" ? "done" : "watching",
      watchlistedAt: null,
    });
    newestWatchedAt = latestTimestamp(newestWatchedAt, watchedAt);
    watchActivityRows.set(`trakt:history:${state.item.id}`, {
      episode_id: episodeId,
      media_id: mediaId,
      provider_event_id: `trakt:history:${state.item.id}`,
      source: "trakt_sync",
      user_id: "",
      watched_at: watchedAt,
    });
    result.episodeHistoryImported += 1;
  }

  for (const state of showWatchlistStates) {
    const mediaId = resolveImportedShowId(state, showResolution, result, "watchlist");

    if (!mediaId) {
      continue;
    }

    const existingDraft = readDraft(mediaId);

    if (existingDraft?.status === "done" || existingDraft?.status === "stopped" || existingDraft?.status === "watching") {
      continue;
    }

    writeDraft({
      completedAt: null,
      completionMode: null,
      lastWatchedAt: null,
      mediaId,
      personalRating: existingDraft?.personalRating ?? null,
      status: "wishlist",
      watchlistedAt: state.listedAt,
    });
    result.showWatchlistImported += 1;
  }

  for (const key of removedWatchlistKeys) {
    const mediaId = showResolution.mediaIdByRemoteKey.get(key);

    if (!mediaId || pendingMediaIds.has(mediaId)) {
      continue;
    }

    const existingDraft = readDraft(mediaId);

    if (existingDraft?.status !== "wishlist") {
      continue;
    }

    drafts.delete(mediaId);
    deletedMediaIds.add(mediaId);
    result.showWatchlistRemoved += 1;
  }

  for (const state of showRatingStates) {
    const mediaId = resolveImportedShowId(state, showResolution, result, "rating");

    if (!mediaId) {
      continue;
    }

    const existingDraft = readDraft(mediaId);

    writeDraft({
      completedAt: existingDraft?.completedAt ?? null,
      completionMode: existingDraft?.completionMode ?? null,
      lastWatchedAt: existingDraft?.lastWatchedAt ?? null,
      mediaId,
      personalRating: state.rating,
      status: existingDraft?.status ?? "watching",
      watchlistedAt: existingDraft?.watchlistedAt ?? null,
    });
    result.showRatingsImported += 1;
  }

  for (const key of removedRatingKeys) {
    const mediaId = showResolution.mediaIdByRemoteKey.get(key);

    if (!mediaId || pendingMediaIds.has(mediaId)) {
      continue;
    }

    const existingDraft = readDraft(mediaId);

    if (!existingDraft || existingDraft.personalRating === null) {
      continue;
    }

    writeDraft({
      ...existingDraft,
      personalRating: null,
    });
    result.showRatingsCleared += 1;
  }

  return {
    deleteMediaIds: Array.from(deletedMediaIds),
    newestWatchedAt,
    upserts: Array.from(drafts.values()),
    watchActivityRows: Array.from(watchActivityRows.values()),
  };
}

function applyUserMediaPlanToMap(
  userMedia: Map<string, UserMediaDraft>,
  plan: { deleteMediaIds: string[]; upserts: UserMediaDraft[] },
) {
  for (const mediaId of plan.deleteMediaIds) {
    userMedia.delete(mediaId);
  }

  for (const draft of plan.upserts) {
    userMedia.set(draft.mediaId, draft);
  }
}

async function storeHistoryCheckpoint(
  run: SyncRunContext,
  payload: {
    changed: boolean;
    itemCount: number;
    newestWatchedAt: string | null;
  },
) {
  await assertTraktSyncRunActive(run.userId, run.runId);

  if (payload.newestWatchedAt) {
    await upsertSyncCursor(provider, historyLastWatchedCursorKey, payload.newestWatchedAt);
  }

  await storePullPhaseCheckpoint("history", run, {
    changed: payload.changed,
    cursorValue: payload.newestWatchedAt,
    itemCount: payload.itemCount,
  });
}

async function storeShowHistoryCheckpoint(
  run: SyncRunContext,
  payload: {
    changed: boolean;
    itemCount: number;
    newestWatchedAt: string | null;
  },
) {
  await assertTraktSyncRunActive(run.userId, run.runId);

  if (payload.newestWatchedAt) {
    await upsertSyncCursor(provider, showHistoryLastWatchedCursorKey, payload.newestWatchedAt);
  }

  await storePullPhaseCheckpoint("shows.history", run, {
    changed: payload.changed,
    cursorValue: payload.newestWatchedAt,
    itemCount: payload.itemCount,
  });
}

async function storeSnapshotCheckpoint(
  phase: Extract<PullCheckpointPhase, "ratings" | "shows.ratings" | "shows.watchlist" | "watchlist">,
  run: SyncRunContext,
  payload: {
    changed: boolean;
    itemCount: number;
    snapshot: string;
  },
) {
  await assertTraktSyncRunActive(run.userId, run.runId);

  if (payload.changed) {
    await upsertSyncCursor(provider, snapshotCursorKey(phase), payload.snapshot);
  }

  await storePullPhaseCheckpoint(phase, run, {
    changed: payload.changed,
    cursorValue: payload.snapshot,
    itemCount: payload.itemCount,
  });
}

async function storeListSnapshots(
  listStates: RemoteTraktListState[],
  run: SyncRunContext,
) {
  await assertTraktSyncRunActive(run.userId, run.runId);

  for (const listState of listStates) {
    if (!listState.itemFetchComplete) {
      continue;
    }

    await upsertSyncCursor(
      provider,
      snapshotCursorKey(`lists.${listState.cursorKey}`),
      listState.snapshot,
    );
    await upsertSyncCursor(
      provider,
      listMetadataCursorKey(listState.cursorKey),
      listState.metadataCursor,
    );
  }

  await storePullPhaseCheckpoint("lists", run, {
    changed: listStates.some((list) => list.changed),
    cursorValue: null,
    itemCount: listStates.reduce(
      (count, list) =>
        count +
        list.movieStatesToTag.length +
        list.showStatesToTag.length +
        list.removedKeys.length,
      0,
    ),
  });
}

async function storePullPhaseCheckpoint(
  phase: PullCheckpointPhase,
  run: SyncRunContext,
  payload: {
    changed: boolean;
    cursorValue: string | null;
    itemCount: number;
  },
) {
  await assertTraktSyncRunActive(run.userId, run.runId);

  const completedAt = new Date().toISOString();

  await upsertSyncCursor(provider, pullPhaseCheckpointCursorKey(phase), completedAt);
  await upsertSyncCursor(
    provider,
    pullCheckpointCursorKey,
    serializePullCheckpoint({
      changed: payload.changed,
      completedAt,
      cursorValue: payload.cursorValue,
      itemCount: payload.itemCount,
      phase,
      runId: run.runId,
    }),
  );
}

async function upsertTraktListTags(
  userId: string,
  listStates: RemoteTraktListState[],
  result: PullResult,
  run: SyncRunContext,
) {
  const tagsByNormalizedName = new Map<string, Tag>();
  const rowsByNormalizedName = new Map<string, TagInsert>();
  const supabase = createSupabaseAdminClient();

  for (const listState of listStates) {
    const normalizedName = normalizeTagName(listState.tagName);

    if (!normalizedName) {
      continue;
    }

    rowsByNormalizedName.set(normalizedName, {
      name: listState.tagName,
      normalized_name: normalizedName,
      user_id: userId,
    });
  }

  for (const normalizedNameChunk of chunkArray(
    Array.from(rowsByNormalizedName.keys()),
    dbReadChunkSize,
  )) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .in("normalized_name", normalizedNameChunk);

    if (error) {
      throwDatabaseError("Failed to load Trakt list tags.", error);
    }

    for (const tag of data ?? []) {
      tagsByNormalizedName.set(tag.normalized_name, tag);
    }
  }

  const missingRows = Array.from(rowsByNormalizedName.values()).filter((row) => {
    const normalizedName = row.normalized_name ?? normalizeTagName(row.name);

    return !tagsByNormalizedName.has(normalizedName);
  });

  for (const rowChunk of chunkArray(missingRows, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase.from("tags").insert(rowChunk).select("*");

    if (!error) {
      for (const tag of data ?? []) {
        tagsByNormalizedName.set(tag.normalized_name, tag);
      }
      continue;
    }

    for (const row of rowChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { data: tag, error: fallbackError } = await supabase
        .from("tags")
        .insert(row)
        .select("*")
        .single();

      if (!fallbackError) {
        tagsByNormalizedName.set(tag.normalized_name, tag);
        continue;
      }

      if (isUniqueConstraintError(fallbackError)) {
        const normalizedName = row.normalized_name ?? normalizeTagName(row.name);
        const { data: existingTag, error: existingError } = await supabase
          .from("tags")
          .select("*")
          .eq("user_id", userId)
          .eq("normalized_name", normalizedName)
          .maybeSingle();

        if (!existingError && existingTag) {
          tagsByNormalizedName.set(existingTag.normalized_name, existingTag);
          continue;
        }
      }

      recordPullFailure(result, "tag", row.normalized_name ?? row.name, fallbackError);
    }
  }

  const tagsByListKey = new Map<string, Tag>();

  for (const listState of listStates) {
    const tag = tagsByNormalizedName.get(normalizeTagName(listState.tagName));

    if (tag) {
      tagsByListKey.set(listState.listKey, tag);
    }
  }

  return tagsByListKey;
}

async function upsertTraktListMovieTags(
  userId: string,
  listStates: RemoteTraktListState[],
  tagsByListKey: Map<string, Tag>,
  movieResolution: MovieResolutionResult,
  result: PullResult,
  run: SyncRunContext,
) {
  const rowsByKey = new Map<string, { media_id: string; tag_id: string; user_id: string }>();
  const supabase = createSupabaseAdminClient();

  for (const listState of listStates) {
    const tag = tagsByListKey.get(listState.listKey);

    if (!tag) {
      recordPullFailure(result, "tag", listState.listKey, "Failed to resolve list tag.");
      continue;
    }

    for (const movieState of listState.movieStatesToTag) {
      const mediaId = resolveImportedMovieId(movieState, movieResolution, result, "list");

      if (!mediaId) {
        continue;
      }

      rowsByKey.set(`${mediaId}:${tag.id}`, {
        media_id: mediaId,
        tag_id: tag.id,
        user_id: userId,
      });
    }
  }

  for (const rowChunk of chunkArray(Array.from(rowsByKey.values()), dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("user_media_tags")
      .upsert(rowChunk, { onConflict: "user_id,media_id,tag_id" });

    if (!error) {
      result.listItemsTagged += rowChunk.length;
      continue;
    }

    for (const row of rowChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error: fallbackError } = await supabase
        .from("user_media_tags")
        .upsert(row, { onConflict: "user_id,media_id,tag_id" });

      if (fallbackError) {
        recordPullFailure(result, "tag", `${row.media_id}:${row.tag_id}`, fallbackError);
      } else {
        result.listItemsTagged += 1;
      }
    }
  }
}

async function upsertTraktListMediaTags(
  userId: string,
  listStates: RemoteTraktListState[],
  tagsByListKey: Map<string, Tag>,
  showResolution: ShowResolutionResult,
  result: PullResult,
  run: SyncRunContext,
) {
  const rowsByKey = new Map<string, { media_id: string; tag_id: string; user_id: string }>();
  const supabase = createSupabaseAdminClient();

  for (const listState of listStates) {
    const tag = tagsByListKey.get(listState.listKey);

    if (!tag) {
      recordPullFailure(result, "tag", listState.listKey, "Failed to resolve list tag.");
      continue;
    }

    for (const showState of listState.showStatesToTag) {
      const mediaId = resolveImportedShowId(showState, showResolution, result, "list");

      if (!mediaId) {
        continue;
      }

      rowsByKey.set(`${mediaId}:${tag.id}`, {
        media_id: mediaId,
        tag_id: tag.id,
        user_id: userId,
      });
    }
  }

  for (const rowChunk of chunkArray(Array.from(rowsByKey.values()), dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("user_media_tags")
      .upsert(rowChunk, { onConflict: "user_id,media_id,tag_id" });

    if (!error) {
      result.listItemsTagged += rowChunk.length;
      continue;
    }

    for (const row of rowChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error: fallbackError } = await supabase
        .from("user_media_tags")
        .upsert(row, { onConflict: "user_id,media_id,tag_id" });

      if (fallbackError) {
        recordPullFailure(result, "tag", `${row.media_id}:${row.tag_id}`, fallbackError);
      } else {
        result.listItemsTagged += 1;
      }
    }
  }
}

async function upsertUserMovieDrafts(
  userId: string,
  drafts: UserMediaDraft[],
  result: PullResult,
  run: SyncRunContext,
) {
  const supabase = createSupabaseAdminClient();
  const rows = drafts.map((draft) => ({
    completed_at: draft.completedAt,
    completion_mode: draft.completionMode,
    last_watched_at: draft.lastWatchedAt,
    media_id: draft.mediaId,
    personal_rating: draft.personalRating,
    status: draft.status,
    user_id: userId,
    watchlisted_at: draft.watchlistedAt,
  }));

  for (const rowChunk of chunkArray(rows, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("user_media")
      .upsert(rowChunk, { onConflict: "user_id,media_id" });

    if (!error) {
      continue;
    }

    for (const row of rowChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error: fallbackError } = await supabase
        .from("user_media")
        .upsert(row, { onConflict: "user_id,media_id" });

      if (fallbackError) {
        recordPullFailure(result, "library", row.media_id, fallbackError);
      }
    }
  }
}

async function deleteUserMedia(
  userId: string,
  mediaIds: string[],
  result: PullResult,
  run: SyncRunContext,
) {
  const supabase = createSupabaseAdminClient();

  for (const mediaIdChunk of chunkArray(mediaIds, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("user_media")
      .delete()
      .eq("user_id", userId)
      .in("media_id", mediaIdChunk);

    if (error) {
      recordPullFailure(result, "watchlist", "show-watchlist-removals", error);
    }
  }
}

async function upsertUserMediaDrafts(
  userId: string,
  drafts: UserMediaDraft[],
  result: PullResult,
  run: SyncRunContext,
) {
  const supabase = createSupabaseAdminClient();
  const rows = drafts.map((draft) => ({
    completed_at: draft.completedAt,
    completion_mode: draft.completionMode,
    last_watched_at: draft.lastWatchedAt,
    media_id: draft.mediaId,
    personal_rating: draft.personalRating,
    status: draft.status,
    user_id: userId,
    watchlisted_at: draft.watchlistedAt,
  }));

  for (const rowChunk of chunkArray(rows, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("user_media")
      .upsert(rowChunk, { onConflict: "user_id,media_id" });

    if (error) {
      recordPullFailure(result, "library", "show-user-media", error);
    }
  }
}

async function insertMediaWatchActivity(
  userId: string,
  rows: MediaWatchActivityInsert[],
  result: PullResult,
  run: SyncRunContext,
) {
  const existingEventIds = await loadExistingMediaWatchActivityEventIds(
    userId,
    rows
      .map((row) => row.provider_event_id)
      .filter((eventId): eventId is string => eventId !== null && eventId !== undefined),
    run,
  );
  const supabase = createSupabaseAdminClient();
  const inserts = rows
    .filter((row) => row.provider_event_id && !existingEventIds.has(row.provider_event_id))
    .map((row) => ({ ...row, user_id: userId }));

  for (const rowChunk of chunkArray(inserts, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase.from("media_watch_activity").insert(rowChunk);

    if (error) {
      recordPullFailure(result, "watch-log", "show-episode-history", error);
    }
  }
}

async function loadExistingMediaWatchActivityEventIds(
  userId: string,
  providerEventIds: string[],
  run: SyncRunContext,
) {
  const existing = new Set<string>();
  const supabase = createSupabaseAdminClient();

  for (const eventIdChunk of chunkArray(uniqueArray(providerEventIds), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase
      .from("media_watch_activity")
      .select("provider_event_id")
      .eq("user_id", userId)
      .in("provider_event_id", eventIdChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load Trakt media watch activity.", error);
    }

    for (const row of data ?? []) {
      if (row.provider_event_id) {
        existing.add(row.provider_event_id);
      }
    }
  }

  return existing;
}


function resolveImportedMovieId(
  remoteMovie: RemoteTraktMovieState,
  resolution: MovieResolutionResult,
  result: PullResult,
  phase: PullFailurePhase,
) {
  const movieId = resolution.movieIdByRemoteKey.get(remoteMovie.key);

  if (movieId) {
    return movieId;
  }

  const failure = resolution.failedRemoteKeys.get(remoteMovie.key);

  if (failure) {
    recordPullFailure(result, phase, remoteMovie.key, failure);
  } else {
    result.skipped += 1;
  }

  return null;
}

function createPullResult(): PullResult {
  const result: PullResult = {
    episodeHistoryImported: 0,
    failed: 0,
    failureSamples: [],
    historyImported: 0,
    listItemFetchesSkipped: 0,
    listItemsTagged: 0,
    listsImported: 0,
    ratingsCleared: 0,
    ratingsImported: 0,
    retryableFailures: 0,
    showRatingsCleared: 0,
    showRatingsImported: 0,
    showWatchlistImported: 0,
    showWatchlistRemoved: 0,
    skipped: 0,
    watchlistImported: 0,
    watchlistRemoved: 0,
  };

  pullItemFailuresByResult.set(result, new Map());

  return result;
}

async function flushPendingPullItemFailures(run: SyncRunContext, result: PullResult) {
  const failures = pullItemFailuresByResult.get(result);

  if (!failures || failures.size === 0) {
    return;
  }

  await assertTraktSyncRunActive(run.userId, run.runId);

  const items = Array.from(failures.values());
  const existingByKey = await loadPendingPullItemFailureMap(run.userId, items);
  const now = new Date().toISOString();
  const rows = items.map((failure): SyncItemFailureInsert => {
    const existing = existingByKey.get(pullItemFailureMapKey(failure.phase, failure.itemKey));

    return {
      user_id: run.userId,
      sync_run_id: run.runId,
      provider,
      direction: "pull",
      phase: failure.phase,
      item_key: failure.itemKey,
      item_payload: failure.itemPayload,
      error_message: failure.errorMessage,
      retry_status: "pending",
      attempt_count: (existing?.attempt_count ?? 0) + 1,
      last_failed_at: now,
      resolved_at: null,
    };
  });
  const supabase = createSupabaseAdminClient();

  for (const rowChunk of chunkArray(rows, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("sync_item_failures")
      .upsert(rowChunk, {
        onConflict: "user_id,provider,direction,phase,item_key,retry_status",
      });

    if (error) {
      throwDatabaseError("Failed to store Trakt item failure retry rows.", error);
    }
  }

  failures.clear();
}

async function loadPendingPullItemFailureMap(
  userId: string,
  failures: PullItemFailure[],
): Promise<Map<string, Pick<SyncItemFailure, "attempt_count" | "item_key" | "phase">>> {
  const existingByKey = new Map<
    string,
    Pick<SyncItemFailure, "attempt_count" | "item_key" | "phase">
  >();
  const supabase = createSupabaseAdminClient();

  for (const failureChunk of chunkArray(failures, dbReadChunkSize)) {
    const phases = uniqueArray(failureChunk.map((failure) => failure.phase));
    const itemKeys = uniqueArray(failureChunk.map((failure) => failure.itemKey));
    const chunkKeys = new Set(
      failureChunk.map((failure) => pullItemFailureMapKey(failure.phase, failure.itemKey)),
    );
    const { data, error } = await supabase
      .from("sync_item_failures")
      .select("attempt_count, item_key, phase")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("direction", "pull")
      .eq("retry_status", "pending")
      .in("phase", phases)
      .in("item_key", itemKeys);

    if (error) {
      throwDatabaseError("Failed to load Trakt item failure retry rows.", error);
    }

    for (const row of data ?? []) {
      const key = pullItemFailureMapKey(row.phase as PullFailurePhase, row.item_key);

      if (chunkKeys.has(key)) {
        existingByKey.set(key, row);
      }
    }
  }

  return existingByKey;
}

function pullItemFailureMapKey(phase: PullFailurePhase, itemKey: string) {
  return `${phase}:${itemKey}`;
}

function draftFromUserMedia(userMedia: {
  completed_at: string | null;
  completion_mode: "manual" | "auto_all_aired" | null;
  last_watched_at: string | null;
  media_id: string;
  personal_rating: number | null;
  status: MediaStatus;
  watchlisted_at: string | null;
}): UserMediaDraft {
  return {
    completedAt: userMedia.completed_at,
    completionMode: userMedia.completion_mode,
    lastWatchedAt: userMedia.last_watched_at,
    mediaId: userMedia.media_id,
    personalRating: userMedia.personal_rating,
    status: userMedia.status,
    watchlistedAt: userMedia.watchlisted_at,
  };
}

function resolveImportedShowId(
  remoteShow: RemoteTraktShowState,
  resolution: ShowResolutionResult,
  result: PullResult,
  phase: PullFailurePhase,
) {
  const mediaId = resolution.mediaIdByRemoteKey.get(remoteShow.key);

  if (mediaId) {
    return mediaId;
  }

  const failure = resolution.failedRemoteKeys.get(remoteShow.key);

  if (failure) {
    recordPullFailure(result, phase, remoteShow.key, failure);
  } else {
    result.skipped += 1;
  }

  return null;
}

function resolveImportedEpisodeId(
  remoteEpisode: RemoteTraktEpisodeState,
  resolution: EpisodeResolutionResult,
  result: PullResult,
  phase: PullFailurePhase,
) {
  const episodeId = resolution.episodeIdByRemoteKey.get(remoteEpisode.key);

  if (episodeId) {
    return episodeId;
  }

  const failure = resolution.failedRemoteKeys.get(remoteEpisode.key);

  if (failure) {
    recordPullFailure(result, phase, remoteEpisode.key, failure);
  } else {
    result.skipped += 1;
  }

  return null;
}

function providerCandidates(
  remoteMovie: RemoteTraktMovieState | RemoteTraktShowState | RemoteTraktEpisodeState,
): ProviderCandidate[] {
  const candidates: ProviderCandidate[] = [];

  if (remoteMovie.traktId) {
    candidates.push({ id: remoteMovie.traktId, provider: "trakt" });
  }

  if (remoteMovie.tmdbId) {
    candidates.push({ id: String(remoteMovie.tmdbId), provider: "tmdb" });
  }

  if (remoteMovie.imdbId) {
    candidates.push({ id: remoteMovie.imdbId, provider: "imdb" });
  }

  return candidates;
}

function idsByProvider(candidates: Iterable<ProviderCandidate>) {
  const idsByProviderName = new Map<"imdb" | "tmdb" | "trakt", Set<string>>();

  for (const candidate of candidates) {
    const ids = idsByProviderName.get(candidate.provider) ?? new Set<string>();

    ids.add(candidate.id);
    idsByProviderName.set(candidate.provider, ids);
  }

  return idsByProviderName;
}

function entityIdsByProvider(
  rows: MediaProviderMappingInsert[],
  key: "episode_id" | "media_id",
) {
  const idsByProviderName = new Map<MediaProviderMappingInsert["provider"], Set<string>>();

  for (const row of rows) {
    const id = row[key];

    if (!id) {
      continue;
    }

    const ids = idsByProviderName.get(row.provider) ?? new Set<string>();

    ids.add(id);
    idsByProviderName.set(row.provider, ids);
  }

  return idsByProviderName;
}

function getTraktListKey(list: TraktUserList) {
  const traktId = Number(list.ids.trakt);

  if (Number.isInteger(traktId) && traktId > 0) {
    return String(traktId);
  }

  if (typeof list.ids.slug === "string") {
    const slug = list.ids.slug.trim();

    if (slug) {
      return slug;
    }
  }

  return null;
}

function normalizeImportedTagName(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, importedTagNameMaxLength).trimEnd();
}

function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseRemoteKey(key: string): ProviderCandidate | null {
  const [providerName, id] = key.split(":", 2);

  if (
    !id ||
    (providerName !== "trakt" && providerName !== "tmdb" && providerName !== "imdb")
  ) {
    return null;
  }

  return {
    id,
    provider: providerName,
  };
}

function candidateMapKey(candidate: ProviderCandidate) {
  return `${candidate.provider}:${candidate.id}`;
}

function recordPullFailure(
  result: PullResult,
  phase: PullFailurePhase,
  itemKey: string,
  error: unknown,
) {
  const errorMessage = getErrorMessage(error);
  const failures = pullItemFailuresByResult.get(result);

  result.failed += 1;

  if (failures) {
    const failureKey = pullItemFailureMapKey(phase, itemKey);
    const alreadyPending = failures.has(failureKey);

    failures.set(failureKey, {
      errorMessage,
      itemKey,
      itemPayload: {},
      phase,
    });

    if (!alreadyPending) {
      result.retryableFailures += 1;
    }
  }

  if (result.failureSamples.length >= failureSampleLimit) {
    return;
  }

  result.failureSamples.push(`${phase}:${itemKey}: ${errorMessage}`);
}

function chunkArray<T>(items: T[], size: number) {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function uniqueArray<T>(items: Iterable<T>) {
  return Array.from(new Set(items));
}

async function loadMovieForPush(movieId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: movie, error: movieError } = await supabase
    .from("media_items")
    .select("*")
    .eq("id", movieId)
    .eq("type", "movie")
    .single();

  if (movieError) {
    throwDatabaseError("Failed to load movie for Trakt sync.", movieError);
  }

  const { data: mappings, error: mappingsError } = await supabase
    .from("media_provider_mappings")
    .select("*")
    .eq("media_id", movieId)
    .eq("provider_media_type", "movie");

  if (mappingsError) {
    throwDatabaseError("Failed to load movie provider mappings.", mappingsError);
  }

  return {
    mappings: (mappings ?? []) as MediaProviderMapping[],
    movie: movie as MediaItem,
  };
}

async function loadShowForPush(showId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: show, error: showError } = await supabase
    .from("media_items")
    .select("*")
    .eq("id", showId)
    .eq("type", "show")
    .single();

  if (showError) {
    throwDatabaseError("Failed to load show for Trakt sync.", showError);
  }

  const { data: mappings, error: mappingsError } = await supabase
    .from("media_provider_mappings")
    .select("*")
    .eq("media_id", showId);

  if (mappingsError) {
    throwDatabaseError("Failed to load show provider mappings.", mappingsError);
  }

  return {
    mappings: (mappings ?? []) as MediaProviderMapping[],
    show: show as MediaItem,
  };
}

async function loadEpisodeForPush(episodeId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .single();

  if (episodeError) {
    throwDatabaseError("Failed to load episode for Trakt sync.", episodeError);
  }

  const { data: mappings, error: mappingsError } = await supabase
    .from("media_provider_mappings")
    .select("*")
    .eq("episode_id", episodeId);

  if (mappingsError) {
    throwDatabaseError("Failed to load episode provider mappings.", mappingsError);
  }

  return {
    episode: episode as Episode,
    mappings: (mappings ?? []) as MediaProviderMapping[],
  };
}

async function loadCursorMap(userId: string): Promise<CursorMap> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_cursors")
    .select("cursor_key, cursor_value")
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) {
    throwDatabaseError("Failed to load Trakt sync cursors.", error);
  }

  return new Map((data ?? []).map((cursor) => [cursor.cursor_key, cursor.cursor_value ?? ""]));
}

async function loadPendingPushMovieIds(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_events")
    .select("payload")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("direction", "push")
    .eq("status", "pending");

  if (error) {
    throwDatabaseError("Failed to load pending Trakt push events.", error);
  }

  return new Set(
    (data ?? [])
      .map((event) => readRecord(event.payload).movieId)
      .filter((movieId): movieId is string => typeof movieId === "string"),
  );
}

async function loadPendingPushMediaIds(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_events")
    .select("payload")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("direction", "push")
    .eq("status", "pending");

  if (error) {
    throwDatabaseError("Failed to load pending Trakt media push events.", error);
  }

  return new Set(
    (data ?? [])
      .flatMap((event) => {
        const payload = readRecord(event.payload);
        return [payload.showId, payload.mediaId].filter(
          (mediaId): mediaId is string => typeof mediaId === "string",
        );
      }),
  );
}

function withSyncResult(payload: Json, response: TraktSyncResponse | Record<string, unknown>) {
  return {
    ...readRecord(payload),
    trakt: response,
  } as Json;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`Missing ${label} for Trakt sync.`, {
      code: "INVALID_SYNC_PAYLOAD",
      status: 400,
    });
  }

  return value.trim();
}

function readNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AppError(`Missing ${label} for Trakt sync.`, {
      code: "INVALID_SYNC_PAYLOAD",
      status: 400,
    });
  }

  return value;
}

export const __traktSyncTestHooks = {
  createPullResult,
  listAllListsWithTaggableItems,
  normalizeListStates,
  resolveRemoteShows,
  storeListSnapshots,
  upsertTraktListMediaTags,
  upsertTraktListTags,
};
