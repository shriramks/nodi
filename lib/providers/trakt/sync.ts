import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { createSyncEvent, updateSyncEventStatus, upsertSyncCursor } from "@/lib/db/mutations";
import { listPendingSyncEvents } from "@/lib/db/queries";
import { activeSyncRunMaxAgeMs } from "@/lib/db/queries/sync-run-state";
import type {
  Json,
  Movie,
  MovieInsert,
  ProviderMapping,
  ProviderMappingInsert,
  ProviderMappingProvider,
  SyncDirection,
  SyncEvent,
  SyncItemFailure,
  SyncItemFailureInsert,
  SyncRunStatus,
  Tag,
  TagInsert,
  UserMovie,
  UserMovieInsert,
  WatchLogInsert,
} from "@/lib/db/types";
import { AppError, getErrorMessage, isAppError } from "@/lib/errors";
import {
  toRemoteTraktMovieState,
  toRemoteTraktRatingState,
  toRemoteTraktWatchlistState,
  toTraktHistoryMovie,
  toTraktRatedMovie,
  toTraktSyncMovie,
  type RemoteTraktMovieState,
  type RemoteTraktRatingState,
  type RemoteTraktWatchlistState,
} from "@/lib/providers/trakt/adapters";
import {
  addTraktHistory,
  addTraktWatchlist,
  getTraktUserSettings,
  listTraktHistoryMoviesPage,
  listTraktListMovieItemsPage,
  listTraktRatedMoviesPage,
  listTraktUserListsPage,
  listTraktWatchlistMoviesPage,
  removeTraktHistory,
  removeTraktRatings,
  removeTraktWatchlist,
  setTraktRatings,
  type TraktHistoryMovie,
  type TraktAuth,
  type TraktListMovie,
  type TraktPagination,
  type TraktRatedMovie,
  type TraktSyncMovie,
  type TraktSyncResponse,
  type TraktUserList,
  type TraktWatchlistMovie,
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
  historyImported: number;
  listItemFetchesSkipped: number;
  listItemsTagged: number;
  listsImported: number;
  ratingsCleared: number;
  ratingsImported: number;
  retryableFailures: number;
  skipped: number;
  watchlistImported: number;
  watchlistRemoved: number;
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
type ProviderCandidate = { id: string; provider: ProviderMappingProvider };
type RemoteHistoryState = {
  item: TraktHistoryMovie;
  movie: RemoteTraktMovieState;
};
type TraktListImport = {
  itemFetchSkipped: boolean;
  items: TraktListMovie[];
  listKey: string;
  metadataCursor: string;
  previousMetadataCursor: string | undefined;
  previousSnapshot: string | undefined;
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
  itemFetchSkipped: boolean;
  listKey: string;
  metadataCursor: string;
  movieStates: RemoteTraktMovieState[];
  movieStatesToTag: RemoteTraktMovieState[];
  removedKeys: string[];
  snapshot: string;
  tagName: string;
};
type PullFailurePhase =
  | "history"
  | "library"
  | "list"
  | "mapping"
  | "metadata"
  | "rating"
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
type UserMovieDraft = {
  lastWatchedAt: string | null;
  movieId: string;
  personalRating: number | null;
  status: "to_watch" | "watched";
  watchlistedAt: string | null;
};
type PushOperation =
  | "history.add"
  | "history.remove"
  | "ratings.remove"
  | "ratings.set"
  | "watchlist.add"
  | "watchlist.remove";
type PreparedPushEvent = {
  event: SyncEvent;
  movie: TraktSyncMovie;
  operation: PushOperation;
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
  const user = await requireUser();
  const run = await createTraktSyncRun(user.id, "pull", {
    current: 0,
    label: "Connecting to Trakt",
    phase: "connect",
    total: 5,
  });
  let progressCurrent = 0;
  let progressTotal = 5;

  try {
    await assertTraktSyncRunActive(user.id, run.id);
    const connection = await loadTraktSyncCredentials(user.id, origin);
    await refreshTraktConnection(user.id, connection);

    const cursors = await loadCursorMap(user.id);
    const result = createPullResult();

    const historyCursor = cursors.get(historyLastWatchedCursorKey) ?? null;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: 0,
      label: "Loading history",
      phase: "fetch",
      total: 5,
    });
    const runContext = { runId: run.id, userId: user.id };
    const historyItems = await listAllHistory(
      connection,
      historyCursor,
      runContext,
      async (count, total) => {
        await updateTraktSyncRunProgress(user.id, run.id, {
          current: 0,
          itemCurrent: count,
          itemLabel: "history items",
          itemTotal: total,
          label: `Loaded ${count} history item(s)`,
          phase: "fetch",
          total: 5,
        });
      },
    );
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: 1,
      itemCurrent: historyItems.length,
      itemLabel: "history items",
      itemTotal: historyItems.length,
      label: `Loaded ${historyItems.length} history item(s)`,
      phase: "fetch",
      total: 5,
    });

    const watchlistItems = await listAllWatchlist(connection, runContext, async (count, total) => {
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: 1,
        itemCurrent: count,
        itemLabel: "watchlist items",
        itemTotal: total,
        label: `Loaded ${count} watchlist item(s)`,
        phase: "fetch",
        total: 5,
      });
    });
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: 2,
      itemCurrent: watchlistItems.length,
      itemLabel: "watchlist items",
      itemTotal: watchlistItems.length,
      label: `Loaded ${watchlistItems.length} watchlist item(s)`,
      phase: "fetch",
      total: 5,
    });

    const ratingItems = await listAllRatings(connection, runContext, async (count, total) => {
      await updateTraktSyncRunProgress(user.id, run.id, {
        current: 2,
        itemCurrent: count,
        itemLabel: "ratings",
        itemTotal: total,
        label: `Loaded ${count} rating(s)`,
        phase: "fetch",
        total: 5,
      });
    });
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: 3,
      itemCurrent: ratingItems.length,
      itemLabel: "ratings",
      itemTotal: ratingItems.length,
      label: `Loaded ${ratingItems.length} rating(s)`,
      phase: "fetch",
      total: 5,
    });

    const listFetch = await listAllListsWithMovieItems(
      connection,
      cursors,
      result,
      runContext,
      async (counts) => {
        await updateTraktSyncRunProgress(user.id, run.id, {
          current: 3,
          itemCurrent: counts.itemCount,
          itemLabel: "list items",
          itemTotal: counts.totalItemCount,
          label: formatListFetchProgressLabel(counts),
          phase: "fetch",
          total: 5,
        });
      },
    );
    const listImports = listFetch.imports;
    result.listItemFetchesSkipped = listFetch.skippedListCount;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: 4,
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
      total: 5,
    });

    const historyStates = normalizeHistoryStates(historyItems, result);
    const watchlistStates = normalizeWatchlistStates(watchlistItems, result);
    const ratingStates = normalizeRatingStates(ratingItems, result);
    const listStates = normalizeListStates(listImports, cursors, result);
    const listStatesToTag = listStates.filter((list) => list.movieStatesToTag.length > 0);
    const changedListCount = listStates.filter((list) => list.changed).length;
    const currentWatchlistKeys = new Set(watchlistStates.map((item) => item.key));
    const rawWatchlistSnapshot = cursors.get(snapshotCursorKey("watchlist"));
    const watchlistSnapshot = serializeStringSnapshot(currentWatchlistKeys);
    const previousWatchlistSnapshot = serializeStringSnapshot(
      parseStringArrayCursor(rawWatchlistSnapshot),
    );
    const watchlistChanged = rawWatchlistSnapshot === undefined ||
      watchlistSnapshot !== previousWatchlistSnapshot;
    const previousWatchlistKeys = parseStringArrayCursor(
      rawWatchlistSnapshot,
    );
    const removedWatchlistKeys = previousWatchlistKeys.filter(
      (key) => !currentWatchlistKeys.has(key),
    );
    const currentRatings = new Map(ratingStates.map((item) => [item.key, item.rating]));
    const rawRatingSnapshot = cursors.get(snapshotCursorKey("ratings"));
    const ratingSnapshot = serializeRatingSnapshot(currentRatings.entries());
    const previousRatingSnapshot = serializeRatingSnapshot(
      Object.entries(parseRatingSnapshot(rawRatingSnapshot)),
    );
    const ratingsChanged = rawRatingSnapshot === undefined ||
      ratingSnapshot !== previousRatingSnapshot;
    const previousRatingKeys = Object.keys(
      parseRatingSnapshot(rawRatingSnapshot),
    );
    const removedRatingKeys = previousRatingKeys.filter((key) => !currentRatings.has(key));
    const activeWatchlistStates = watchlistChanged ? watchlistStates : [];
    const activeRemovedWatchlistKeys = watchlistChanged ? removedWatchlistKeys : [];
    const activeRatingStates = ratingsChanged ? ratingStates : [];
    const activeRemovedRatingKeys = ratingsChanged ? removedRatingKeys : [];
    const activeReconcileItemCount =
      historyStates.length +
      activeWatchlistStates.length +
      activeRemovedWatchlistKeys.length +
      activeRatingStates.length +
      activeRemovedRatingKeys.length +
      listStatesToTag.reduce((count, list) => count + list.movieStatesToTag.length, 0);
    const reconcileBatchCount = Math.ceil(activeReconcileItemCount / dbWriteChunkSize);

    progressTotal = 8 + reconcileBatchCount;
    progressCurrent = 0;
    await updateTraktSyncRunProgress(user.id, run.id, {
      current: progressCurrent,
      itemCurrent: 0,
      itemLabel: "items",
      itemTotal: activeReconcileItemCount,
      label: "Resolving Trakt movies",
      phase: "reconcile",
      total: progressTotal,
    });

    const movieResolution = await resolveRemoteMovies({
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

    await upsertResolvedProviderMappings(movieResolution, result, runContext);
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

    const pendingMovieIds = await loadPendingPushMovieIds(user.id);
    const existingUserMovies = await loadUserMovieMap(
      user.id,
      movieResolution.movieIdByRemoteKey.values(),
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
    const historyLogs = buildWatchLogInserts(user.id, historyStates, movieResolution);
    await insertWatchLogs(user.id, historyLogs, result, runContext);
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

    await deleteUserMovies(user.id, watchlistPlan.deleteMovieIds, result, runContext);
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

    const tagsByListKey = await upsertTraktListTags(user.id, listStatesToTag, result, runContext);
    await upsertTraktListMovieTags(
      user.id,
      listStatesToTag,
      tagsByListKey,
      movieResolution,
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
  const movieId = readString(payload.movieId, "movieId");
  const { mappings, movie } = await loadMovieForPush(movieId);
  let traktMovie: TraktSyncMovie;

  switch (operation) {
    case "history.add":
      traktMovie = toTraktHistoryMovie(
        movie,
        readString(payload.watchedAt, "watchedAt"),
        mappings,
      );
      break;
    case "ratings.set":
      traktMovie = toTraktRatedMovie(
        movie,
        Math.min(Math.max(Math.round(readNumber(payload.personalRating, "personalRating")), 1), 10),
        event.created_at,
        mappings,
      );
      break;
    case "history.remove":
    case "ratings.remove":
    case "watchlist.add":
    case "watchlist.remove":
      traktMovie = toTraktSyncMovie(movie, mappings);
      break;
    default:
      traktMovie = assertNever(operation);
  }

  return {
    event,
    movie: traktMovie,
    operation,
  };
}

function pushPreparedBatch(auth: TraktAuth, batch: PreparedPushEvent[]) {
  const operation = batch[0]?.operation;
  const body = { movies: batch.map((entry) => entry.movie) };

  switch (operation) {
    case "history.add":
      return addTraktHistory(auth, body);
    case "history.remove":
      return removeTraktHistory(auth, body);
    case "ratings.remove":
      return removeTraktRatings(auth, body);
    case "ratings.set":
      return setTraktRatings(auth, body);
    case "watchlist.add":
      return addTraktWatchlist(auth, body);
    case "watchlist.remove":
      return removeTraktWatchlist(auth, body);
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

async function listAllListsWithMovieItems(
  auth: TraktAuth,
  cursors: CursorMap,
  result: PullResult,
  run: SyncRunContext,
  onProgress?: (counts: TraktListFetchProgress) => Promise<void>,
): Promise<TraktListFetchResult> {
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

    const metadataCursor = serializeListMetadataCursor({
      itemCount: list.item_count,
      tagName,
      updatedAt: list.updated_at,
    });
    const previousSnapshot = cursors.get(snapshotCursorKey(`lists.${listKey}`));
    const previousMetadataCursor = cursors.get(listMetadataCursorKey(listKey));
    const canReuseSnapshot = canSkipListItemFetch({
      currentMetadataCursor: metadataCursor,
      hasStableMetadata: hasStableTraktListMetadata(list),
      previousItemSnapshot: previousSnapshot,
      previousMetadataCursor,
    });

    if (canReuseSnapshot) {
      skippedListCount += 1;
      imports.push({
        itemFetchSkipped: true,
        items: [],
        listKey,
        metadataCursor,
        previousMetadataCursor,
        previousSnapshot,
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

    let items: TraktListMovie[];

    try {
      items = await listAllListMovieItems(auth, listKey, run, async (count) => {
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

    itemCount += items.length;
    imports.push({
      itemFetchSkipped: false,
      items,
      listKey,
      metadataCursor,
      previousMetadataCursor,
      previousSnapshot,
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
        itemFetchSkipped: true,
        listKey: listImport.listKey,
        metadataCursor: listImport.metadataCursor,
        movieStates: [],
        movieStatesToTag: [],
        removedKeys: [],
        snapshot: listImport.previousSnapshot ?? serializeStringSnapshot([]),
        tagName: listImport.tagName,
      });
      continue;
    }

    const movieStatesByKey = new Map<string, RemoteTraktMovieState>();

    for (const item of listImport.items) {
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

    const delta = getStringSnapshotDelta(
      movieStatesByKey.keys(),
      listImport.previousSnapshot ?? cursors.get(snapshotCursorKey(`lists.${listImport.listKey}`)),
    );
    const movieStatesToTag: RemoteTraktMovieState[] = Array.from(movieStatesByKey.values());

    states.push({
      changed: delta.changed,
      itemFetchSkipped: false,
      listKey: listImport.listKey,
      metadataCursor: listImport.metadataCursor,
      movieStates: Array.from(movieStatesByKey.values()),
      movieStatesToTag,
      removedKeys: delta.removedKeys,
      snapshot: delta.snapshot,
      tagName: listImport.tagName,
    });
  }

  result.listsImported = states.filter((list) => list.movieStatesToTag.length > 0).length;

  return states;
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

  const providerMappings = await loadProviderMappingMap(
    Array.from(remoteMoviesByKey.values()),
    remoteKeys,
    run,
  );
  const mappedMovieIds = new Set(
    Array.from(providerMappings.values()).map((mapping) => mapping.movie_id),
  );
  const moviesById = await loadMovieMapByIds(mappedMovieIds, run);
  const moviesByTmdb = await loadMovieMapByTmdbIds(
    Array.from(remoteMoviesByKey.values())
      .map((movie) => movie.tmdbId)
      .filter((tmdbId): tmdbId is number => tmdbId !== null),
    run,
  );
  const moviesByImdb = await loadMovieMapByImdbIds(
    Array.from(remoteMoviesByKey.values())
      .map((movie) => movie.imdbId)
      .filter((imdbId): imdbId is string => imdbId !== null),
    run,
  );
  const movieIdByRemoteKey = new Map<string, string>();
  const failedRemoteKeys = new Map<string, string>();
  const unknownByTmdb = new Map<number, RemoteTraktMovieState>();

  for (const key of remoteKeys) {
    const candidate = parseRemoteKey(key);
    const mappedMovieId = candidate
      ? providerMappings.get(candidateMapKey(candidate))?.movie_id
      : null;

    if (mappedMovieId && moviesById.has(mappedMovieId)) {
      movieIdByRemoteKey.set(key, mappedMovieId);
    }
  }

  for (const movie of remoteMoviesByKey.values()) {
    const mappedMovie = findMappedMovie(movie, providerMappings, moviesById);

    if (mappedMovie) {
      movieIdByRemoteKey.set(movie.key, mappedMovie.id);
      continue;
    }

    const movieByTmdb = movie.tmdbId ? moviesByTmdb.get(movie.tmdbId) : null;

    if (movieByTmdb) {
      movieIdByRemoteKey.set(movie.key, movieByTmdb.id);
      continue;
    }

    const movieByImdb = movie.imdbId ? moviesByImdb.get(movie.imdbId) : null;

    if (movieByImdb) {
      movieIdByRemoteKey.set(movie.key, movieByImdb.id);
      continue;
    }

    if (movie.tmdbId && !unknownByTmdb.has(movie.tmdbId)) {
      unknownByTmdb.set(movie.tmdbId, movie);
    }
  }

  const insertedMoviesByTmdb = await upsertMinimalTraktMovies(
    Array.from(unknownByTmdb.values()),
    result,
    run,
  );

  for (const movie of remoteMoviesByKey.values()) {
    if (movieIdByRemoteKey.has(movie.key)) {
      continue;
    }

    const insertedMovie = movie.tmdbId ? insertedMoviesByTmdb.get(movie.tmdbId) : null;

    if (insertedMovie) {
      movieIdByRemoteKey.set(movie.key, insertedMovie.id);
    } else if (movie.tmdbId && unknownByTmdb.has(movie.tmdbId)) {
      failedRemoteKeys.set(movie.key, `Failed to create TMDB ${movie.tmdbId}.`);
    }
  }

  return {
    failedRemoteKeys,
    movieIdByRemoteKey,
    remoteMoviesByKey,
  };
}

async function loadProviderMappingMap(
  remoteMovies: RemoteTraktMovieState[],
  remoteKeys: string[],
  run: SyncRunContext,
) {
  const candidates = new Map<string, ProviderCandidate>();

  for (const movie of remoteMovies) {
    for (const candidate of providerCandidates(movie)) {
      candidates.set(candidateMapKey(candidate), candidate);
    }
  }

  for (const key of remoteKeys) {
    const candidate = parseRemoteKey(key);

    if (candidate) {
      candidates.set(candidateMapKey(candidate), candidate);
    }
  }

  const idsByProvider = new Map<ProviderMappingProvider, Set<string>>();

  for (const candidate of candidates.values()) {
    const ids = idsByProvider.get(candidate.provider) ?? new Set<string>();

    ids.add(candidate.id);
    idsByProvider.set(candidate.provider, ids);
  }

  const mappings = new Map<string, ProviderMapping>();
  const supabase = createSupabaseAdminClient();

  for (const [providerName, ids] of idsByProvider.entries()) {
    for (const idChunk of chunkArray(Array.from(ids), dbReadChunkSize)) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { data, error } = await supabase
        .from("provider_mappings")
        .select("*")
        .eq("provider", providerName)
        .in("provider_movie_id", idChunk);

      if (error) {
        throwDatabaseError("Failed to bulk load provider mappings.", error);
      }

      for (const mapping of data ?? []) {
        mappings.set(
          candidateMapKey({
            id: mapping.provider_movie_id,
            provider: mapping.provider,
          }),
          mapping,
        );
      }
    }
  }

  return mappings;
}

async function loadMovieMapByIds(ids: Iterable<string>, run: SyncRunContext) {
  const movies = new Map<string, Movie>();
  const supabase = createSupabaseAdminClient();

  for (const idChunk of chunkArray(uniqueArray(ids), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase.from("movies").select("*").in("id", idChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load mapped movies.", error);
    }

    for (const movie of data ?? []) {
      movies.set(movie.id, movie);
    }
  }

  return movies;
}

async function loadMovieMapByTmdbIds(ids: Iterable<number>, run: SyncRunContext) {
  const movies = new Map<number, Movie>();
  const supabase = createSupabaseAdminClient();

  for (const idChunk of chunkArray(uniqueArray(ids), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase.from("movies").select("*").in("tmdb_id", idChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load TMDB movies.", error);
    }

    for (const movie of data ?? []) {
      movies.set(movie.tmdb_id, movie);
    }
  }

  return movies;
}

async function loadMovieMapByImdbIds(ids: Iterable<string>, run: SyncRunContext) {
  const movies = new Map<string, Movie>();
  const supabase = createSupabaseAdminClient();

  for (const idChunk of chunkArray(uniqueArray(ids), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase.from("movies").select("*").in("imdb_id", idChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load IMDb movies.", error);
    }

    for (const movie of data ?? []) {
      if (movie.imdb_id) {
        movies.set(movie.imdb_id, movie);
      }
    }
  }

  return movies;
}

async function upsertMinimalTraktMovies(
  remoteMovies: RemoteTraktMovieState[],
  result: PullResult,
  run: SyncRunContext,
) {
  const movies = new Map<number, Movie>();
  const rows: MovieInsert[] = remoteMovies
    .filter((movie): movie is RemoteTraktMovieState & { tmdbId: number } => movie.tmdbId !== null)
    .map((movie) => ({
      imdb_id: movie.imdbId,
      title: movie.title?.trim() || `TMDB ${movie.tmdbId}`,
      tmdb_id: movie.tmdbId,
    }));
  const supabase = createSupabaseAdminClient();

  for (const rowChunk of chunkArray(rows, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase
      .from("movies")
      .upsert(rowChunk, { onConflict: "tmdb_id" })
      .select("*");

    if (!error) {
      for (const movie of data ?? []) {
        movies.set(movie.tmdb_id, movie);
      }
      continue;
    }

    for (const row of rowChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { data: fallbackMovie, error: fallbackError } = await supabase
        .from("movies")
        .upsert(row, { onConflict: "tmdb_id" })
        .select("*")
        .single();

      if (fallbackError) {
        recordPullFailure(result, "metadata", `tmdb:${row.tmdb_id}`, fallbackError);
      } else {
        movies.set(fallbackMovie.tmdb_id, fallbackMovie);
      }
    }
  }

  return movies;
}

function findMappedMovie(
  remoteMovie: RemoteTraktMovieState,
  mappings: Map<string, ProviderMapping>,
  moviesById: Map<string, Movie>,
) {
  for (const candidate of providerCandidates(remoteMovie)) {
    const movieId = mappings.get(candidateMapKey(candidate))?.movie_id;

    if (movieId) {
      const movie = moviesById.get(movieId);

      if (movie) {
        return movie;
      }
    }
  }

  return null;
}

async function upsertResolvedProviderMappings(
  resolution: MovieResolutionResult,
  result: PullResult,
  run: SyncRunContext,
) {
  const mappings = buildProviderMappingInserts(resolution);
  const movieIdsByProvider = new Map<ProviderMappingProvider, Set<string>>();
  const supabase = createSupabaseAdminClient();

  for (const mapping of mappings) {
    const ids = movieIdsByProvider.get(mapping.provider) ?? new Set<string>();

    ids.add(mapping.movie_id);
    movieIdsByProvider.set(mapping.provider, ids);
  }

  for (const [providerName, movieIds] of movieIdsByProvider.entries()) {
    for (const movieIdChunk of chunkArray(Array.from(movieIds), dbWriteChunkSize)) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error } = await supabase
        .from("provider_mappings")
        .delete()
        .eq("provider", providerName)
        .in("movie_id", movieIdChunk);

      if (error) {
        throwDatabaseError("Failed to replace Trakt provider mappings.", error);
      }
    }
  }

  for (const mappingChunk of chunkArray(mappings, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("provider_mappings")
      .upsert(mappingChunk, { onConflict: "provider,provider_movie_id" });

    if (!error) {
      continue;
    }

    for (const mapping of mappingChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error: fallbackError } = await supabase
        .from("provider_mappings")
        .upsert(mapping, { onConflict: "provider,provider_movie_id" });

      if (fallbackError) {
        recordPullFailure(
          result,
          "mapping",
          `${mapping.provider}:${mapping.provider_movie_id}`,
          fallbackError,
        );
      }
    }
  }
}

function buildProviderMappingInserts(resolution: MovieResolutionResult) {
  const mappings = new Map<string, ProviderMappingInsert>();
  const usedMovieProviderKeys = new Set<string>();

  for (const movie of resolution.remoteMoviesByKey.values()) {
    const movieId = resolution.movieIdByRemoteKey.get(movie.key);

    if (!movieId) {
      continue;
    }

    for (const candidate of providerCandidates(movie)) {
      const movieProviderKey = `${movieId}:${candidate.provider}`;

      if (usedMovieProviderKeys.has(movieProviderKey)) {
        continue;
      }

      usedMovieProviderKeys.add(movieProviderKey);
      mappings.set(candidateMapKey(candidate), {
        movie_id: movieId,
        provider: candidate.provider,
        provider_movie_id: candidate.id,
      });
    }
  }

  return Array.from(mappings.values());
}

async function loadUserMovieMap(
  userId: string,
  movieIds: Iterable<string>,
  run: SyncRunContext,
) {
  const userMovies = new Map<string, UserMovieDraft>();
  const supabase = createSupabaseAdminClient();

  for (const movieIdChunk of chunkArray(uniqueArray(movieIds), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase
      .from("user_movies")
      .select("*")
      .eq("user_id", userId)
      .in("movie_id", movieIdChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load user movie state.", error);
    }

    for (const userMovie of data ?? []) {
      userMovies.set(userMovie.movie_id, draftFromUserMovie(userMovie));
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
  existingUserMovies: Map<string, UserMovieDraft>;
  historyStates: RemoteHistoryState[];
  movieResolution: MovieResolutionResult;
  pendingMovieIds: Set<string>;
  ratingStates: RemoteTraktRatingState[];
  removedRatingKeys: string[];
  removedWatchlistKeys: string[];
  result: PullResult;
  watchlistStates: RemoteTraktWatchlistState[];
}) {
  const drafts = new Map<string, UserMovieDraft>();
  const deletedMovieIds = new Set<string>();
  let newestWatchedAt: string | null = null;

  function readDraft(movieId: string): UserMovieDraft | null {
    if (drafts.has(movieId)) {
      return drafts.get(movieId) ?? null;
    }

    if (deletedMovieIds.has(movieId)) {
      return null;
    }

    return existingUserMovies.get(movieId) ?? null;
  }

  function writeDraft(draft: UserMovieDraft) {
    deletedMovieIds.delete(draft.movieId);
    drafts.set(draft.movieId, draft);
  }

  for (const state of historyStates) {
    const movieId = resolveImportedMovieId(state.movie, movieResolution, result, "history");

    if (!movieId) {
      continue;
    }

    const existingDraft = readDraft(movieId);

    writeDraft({
      lastWatchedAt: latestTimestamp(existingDraft?.lastWatchedAt, state.item.watched_at),
      movieId,
      personalRating: existingDraft?.personalRating ?? null,
      status: "watched",
      watchlistedAt: null,
    });
    newestWatchedAt = latestTimestamp(newestWatchedAt, state.item.watched_at);
    result.historyImported += 1;
  }

  for (const state of watchlistStates) {
    const movieId = resolveImportedMovieId(state, movieResolution, result, "watchlist");

    if (!movieId) {
      continue;
    }

    const existingDraft = readDraft(movieId);

    if (existingDraft?.status === "watched") {
      continue;
    }

    writeDraft({
      lastWatchedAt: null,
      movieId,
      personalRating: existingDraft?.personalRating ?? null,
      status: "to_watch",
      watchlistedAt: state.listedAt,
    });
    result.watchlistImported += 1;
  }

  for (const key of removedWatchlistKeys) {
    const movieId = movieResolution.movieIdByRemoteKey.get(key);

    if (!movieId || pendingMovieIds.has(movieId)) {
      continue;
    }

    const existingDraft = readDraft(movieId);

    if (existingDraft?.status !== "to_watch") {
      continue;
    }

    drafts.delete(movieId);
    deletedMovieIds.add(movieId);
    result.watchlistRemoved += 1;
  }

  for (const state of ratingStates) {
    const movieId = resolveImportedMovieId(state, movieResolution, result, "rating");

    if (!movieId) {
      continue;
    }

    const existingDraft = readDraft(movieId);

    writeDraft({
      lastWatchedAt: existingDraft?.lastWatchedAt ?? null,
      movieId,
      personalRating: state.rating,
      status: existingDraft?.status ?? "watched",
      watchlistedAt: existingDraft?.watchlistedAt ?? null,
    });
    result.ratingsImported += 1;
  }

  for (const key of removedRatingKeys) {
    const movieId = movieResolution.movieIdByRemoteKey.get(key);

    if (!movieId || pendingMovieIds.has(movieId)) {
      continue;
    }

    const existingDraft = readDraft(movieId);

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
    deleteMovieIds: Array.from(deletedMovieIds),
    newestWatchedAt,
    upserts: Array.from(drafts.values()),
  };
}

function applyUserMoviePlanToMap(
  userMovies: Map<string, UserMovieDraft>,
  plan: { deleteMovieIds: string[]; upserts: UserMovieDraft[] },
) {
  for (const movieId of plan.deleteMovieIds) {
    userMovies.delete(movieId);
  }

  for (const draft of plan.upserts) {
    userMovies.set(draft.movieId, draft);
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

async function storeSnapshotCheckpoint(
  phase: Extract<PullCheckpointPhase, "ratings" | "watchlist">,
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
    await upsertSyncCursor(
      provider,
      snapshotCursorKey(`lists.${listState.listKey}`),
      listState.snapshot,
    );
    await upsertSyncCursor(
      provider,
      listMetadataCursorKey(listState.listKey),
      listState.metadataCursor,
    );
  }

  await storePullPhaseCheckpoint("lists", run, {
    changed: listStates.some((list) => list.changed),
    cursorValue: null,
    itemCount: listStates.reduce(
      (count, list) => count + list.movieStatesToTag.length + list.removedKeys.length,
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
  const rowsByKey = new Map<string, { movie_id: string; tag_id: string; user_id: string }>();
  const supabase = createSupabaseAdminClient();

  for (const listState of listStates) {
    const tag = tagsByListKey.get(listState.listKey);

    if (!tag) {
      recordPullFailure(result, "tag", listState.listKey, "Failed to resolve list tag.");
      continue;
    }

    for (const movieState of listState.movieStatesToTag) {
      const movieId = resolveImportedMovieId(movieState, movieResolution, result, "list");

      if (!movieId) {
        continue;
      }

      rowsByKey.set(`${movieId}:${tag.id}`, {
        movie_id: movieId,
        tag_id: tag.id,
        user_id: userId,
      });
    }
  }

  for (const rowChunk of chunkArray(Array.from(rowsByKey.values()), dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("user_movie_tags")
      .upsert(rowChunk, { onConflict: "user_id,movie_id,tag_id" });

    if (!error) {
      result.listItemsTagged += rowChunk.length;
      continue;
    }

    for (const row of rowChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error: fallbackError } = await supabase
        .from("user_movie_tags")
        .upsert(row, { onConflict: "user_id,movie_id,tag_id" });

      if (fallbackError) {
        recordPullFailure(result, "tag", `${row.movie_id}:${row.tag_id}`, fallbackError);
      } else {
        result.listItemsTagged += 1;
      }
    }
  }
}

async function deleteUserMovies(
  userId: string,
  movieIds: string[],
  result: PullResult,
  run: SyncRunContext,
) {
  const supabase = createSupabaseAdminClient();

  for (const movieIdChunk of chunkArray(movieIds, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("user_movies")
      .delete()
      .eq("user_id", userId)
      .in("movie_id", movieIdChunk);

    if (!error) {
      continue;
    }

    for (const movieId of movieIdChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error: fallbackError } = await supabase
        .from("user_movies")
        .delete()
        .eq("user_id", userId)
        .eq("movie_id", movieId);

      if (fallbackError) {
        recordPullFailure(result, "watchlist", movieId, fallbackError);
      }
    }
  }
}

async function upsertUserMovieDrafts(
  userId: string,
  drafts: UserMovieDraft[],
  result: PullResult,
  run: SyncRunContext,
) {
  const supabase = createSupabaseAdminClient();
  const rows = drafts.map((draft): UserMovieInsert => ({
    user_id: userId,
    movie_id: draft.movieId,
    status: draft.status,
    personal_rating: draft.personalRating,
    watchlisted_at: draft.watchlistedAt,
    last_watched_at: draft.lastWatchedAt,
  }));

  for (const rowChunk of chunkArray(rows, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase
      .from("user_movies")
      .upsert(rowChunk, { onConflict: "user_id,movie_id" });

    if (!error) {
      continue;
    }

    for (const row of rowChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error: fallbackError } = await supabase
        .from("user_movies")
        .upsert(row, { onConflict: "user_id,movie_id" });

      if (fallbackError) {
        recordPullFailure(result, "library", row.movie_id, fallbackError);
      }
    }
  }
}

function buildWatchLogInserts(
  userId: string,
  historyStates: RemoteHistoryState[],
  movieResolution: MovieResolutionResult,
) {
  const logs = new Map<string, WatchLogInsert>();

  for (const state of historyStates) {
    const movieId = movieResolution.movieIdByRemoteKey.get(state.movie.key);

    if (!movieId) {
      continue;
    }

    const providerEventId = `trakt:history:${state.item.id}`;

    logs.set(providerEventId, {
      user_id: userId,
      movie_id: movieId,
      watched_at: state.item.watched_at,
      source: "trakt_sync",
      provider_event_id: providerEventId,
    });
  }

  return Array.from(logs.values());
}

async function insertWatchLogs(
  userId: string,
  logs: WatchLogInsert[],
  result: PullResult,
  run: SyncRunContext,
) {
  const existingEventIds = await loadExistingWatchLogEventIds(
    userId,
    logs
      .map((log) => log.provider_event_id)
      .filter((eventId): eventId is string => eventId !== null && eventId !== undefined),
    run,
  );
  const supabase = createSupabaseAdminClient();
  const rows = logs.filter(
    (log) => log.provider_event_id && !existingEventIds.has(log.provider_event_id),
  );

  for (const rowChunk of chunkArray(rows, dbWriteChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { error } = await supabase.from("watch_logs").insert(rowChunk);

    if (!error) {
      continue;
    }

    for (const row of rowChunk) {
      await assertTraktSyncRunActive(run.userId, run.runId);
      const { error: fallbackError } = await supabase.from("watch_logs").insert(row);

      if (!fallbackError || isUniqueConstraintError(fallbackError)) {
        continue;
      }

      recordPullFailure(result, "watch-log", row.provider_event_id ?? row.movie_id, fallbackError);
    }
  }
}

async function loadExistingWatchLogEventIds(
  userId: string,
  providerEventIds: string[],
  run: SyncRunContext,
) {
  const existing = new Set<string>();
  const supabase = createSupabaseAdminClient();

  for (const eventIdChunk of chunkArray(uniqueArray(providerEventIds), dbReadChunkSize)) {
    await assertTraktSyncRunActive(run.userId, run.runId);
    const { data, error } = await supabase
      .from("watch_logs")
      .select("provider_event_id")
      .eq("user_id", userId)
      .in("provider_event_id", eventIdChunk);

    if (error) {
      throwDatabaseError("Failed to bulk load Trakt watch logs.", error);
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
    failed: 0,
    failureSamples: [],
    historyImported: 0,
    listItemFetchesSkipped: 0,
    listItemsTagged: 0,
    listsImported: 0,
    ratingsCleared: 0,
    ratingsImported: 0,
    retryableFailures: 0,
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

function draftFromUserMovie(userMovie: UserMovie): UserMovieDraft {
  return {
    lastWatchedAt: userMovie.last_watched_at,
    movieId: userMovie.movie_id,
    personalRating: userMovie.personal_rating,
    status: userMovie.status,
    watchlistedAt: userMovie.watchlisted_at,
  };
}

function providerCandidates(remoteMovie: RemoteTraktMovieState): ProviderCandidate[] {
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
    .from("movies")
    .select("*")
    .eq("id", movieId)
    .single();

  if (movieError) {
    throwDatabaseError("Failed to load movie for Trakt sync.", movieError);
  }

  const { data: mappings, error: mappingsError } = await supabase
    .from("provider_mappings")
    .select("*")
    .eq("movie_id", movieId);

  if (mappingsError) {
    throwDatabaseError("Failed to load movie provider mappings.", mappingsError);
  }

  return {
    mappings: (mappings ?? []) as ProviderMapping[],
    movie,
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
