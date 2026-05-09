import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { createSyncEvent, updateSyncEventStatus, upsertSyncCursor } from "@/lib/db/mutations";
import { listPendingSyncEvents } from "@/lib/db/queries";
import type {
  Json,
  Movie,
  MovieInsert,
  ProviderMapping,
  ProviderMappingInsert,
  SyncEvent,
  UserMovie,
} from "@/lib/db/types";
import { AppError, getErrorMessage } from "@/lib/errors";
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
  listTraktHistoryMovies,
  listTraktRatedMovies,
  listTraktWatchlistMovies,
  removeTraktHistory,
  removeTraktRatings,
  removeTraktWatchlist,
  setTraktRatings,
  type TraktHistoryMovie,
  type TraktAuth,
  type TraktSyncResponse,
} from "@/lib/providers/trakt/client";
import { loadTraktSyncCredentials } from "@/lib/providers/trakt/credentials";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type PushResult = {
  failed: number;
  processed: number;
  skipped: number;
  succeeded: number;
};

type PullResult = {
  historyImported: number;
  ratingsCleared: number;
  ratingsImported: number;
  skipped: number;
  watchlistImported: number;
  watchlistRemoved: number;
};

type SyncProgressDirection = "pull" | "push";

type SyncProgressPayload = {
  current: number;
  label: string;
  phase: string;
  total: number;
};

type CursorMap = Map<string, string>;

const provider = "trakt" as const;
const pageLimit = 100;
const maxHistoryPages = 20;
const maxWatchlistPages = 20;

export async function pushTraktSync(origin: string, limit = 50): Promise<PushResult> {
  const user = await requireUser();
  const progress = await createSyncProgress("push", {
    current: 0,
    label: "Connecting to Trakt",
    phase: "connect",
    total: 0,
  });
  let progressCurrent = 0;
  let progressTotal = 0;

  try {
    const connection = await loadTraktSyncCredentials(user.id, origin);
    await refreshTraktConnection(user.id, connection);

    const events = await listPendingSyncEvents(provider, "push", limit);
    progressTotal = events.length;
    await updateSyncProgress(progress, {
      current: 0,
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

    for (const event of events) {
      try {
        const pushResponse = await pushSyncEvent(connection, event);
        const skipped = Boolean(readRecord(pushResponse).skipped);

        await updateSyncEventStatus(event.id, {
          payload: withSyncResult(event.payload, pushResponse),
          processedAt: new Date().toISOString(),
          status: "success",
        });

        if (skipped) {
          result.skipped += 1;
        } else {
          result.succeeded += 1;
        }
      } catch (error) {
        result.failed += 1;
        await updateSyncEventStatus(event.id, {
          errorMessage: getErrorMessage(error),
          payload: event.payload,
          processedAt: new Date().toISOString(),
          status: "error",
        });
      }

      progressCurrent += 1;
      await updateSyncProgress(progress, {
        current: progressCurrent,
        label: `Processed ${progressCurrent} of ${progressTotal}`,
        phase: "push",
        total: progressTotal,
      });
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
    await updateSyncProgress(
      progress,
      {
        current: progressTotal,
        label: result.failed > 0 ? "Push completed with failures" : "Push complete",
        phase: "complete",
        total: progressTotal,
      },
      result.failed > 0 ? "error" : "success",
      result.failed > 0 ? `${result.failed} Trakt push event(s) failed.` : null,
    );

    return result;
  } catch (error) {
    await updateSyncProgress(
      progress,
      {
        current: progressCurrent,
        label: "Push failed",
        phase: "error",
        total: progressTotal,
      },
      "error",
      getErrorMessage(error),
    );
    throw error;
  }
}

export async function pullTraktSync(origin: string): Promise<PullResult> {
  const user = await requireUser();
  const progress = await createSyncProgress("pull", {
    current: 0,
    label: "Connecting to Trakt",
    phase: "connect",
    total: 4,
  });
  let progressCurrent = 0;
  let progressTotal = 4;

  try {
    const connection = await loadTraktSyncCredentials(user.id, origin);
    await refreshTraktConnection(user.id, connection);

    const cursors = await loadCursorMap(user.id);
    const pendingMovieIds = await loadPendingPushMovieIds(user.id);
    const result: PullResult = {
      historyImported: 0,
      ratingsCleared: 0,
      ratingsImported: 0,
      skipped: 0,
      watchlistImported: 0,
      watchlistRemoved: 0,
    };

    const historyCursor = cursors.get("history.last_watched_at") ?? null;
    await updateSyncProgress(progress, {
      current: 0,
      label: "Loading history",
      phase: "fetch",
      total: 4,
    });
    const historyItems = await listAllHistory(connection, historyCursor);
    await updateSyncProgress(progress, {
      current: 1,
      label: `Loaded ${historyItems.length} history item(s)`,
      phase: "fetch",
      total: 4,
    });

    const watchlistItems = await listAllWatchlist(connection);
    const watchlistStates = watchlistItems
      .map(toRemoteTraktWatchlistState)
      .filter((item): item is RemoteTraktWatchlistState => item !== null);
    await updateSyncProgress(progress, {
      current: 2,
      label: `Loaded ${watchlistStates.length} watchlist item(s)`,
      phase: "fetch",
      total: 4,
    });

    const ratingItems = await listTraktRatedMovies(connection);
    const ratingStates = ratingItems
      .map(toRemoteTraktRatingState)
      .filter((item): item is RemoteTraktRatingState => item !== null);
    await updateSyncProgress(progress, {
      current: 3,
      label: `Loaded ${ratingStates.length} rating(s)`,
      phase: "fetch",
      total: 4,
    });

    let newestWatchedAt = historyCursor;
    const currentWatchlistKeys = new Set(watchlistStates.map((item) => item.key));
    const previousWatchlistKeys = parseStringArrayCursor(cursors.get("watchlist.snapshot"));
    const removedWatchlistKeys = previousWatchlistKeys.filter(
      (key) => !currentWatchlistKeys.has(key),
    );
    const currentRatings = new Map(ratingStates.map((item) => [item.key, item.rating]));
    const previousRatingKeys = Object.keys(parseRatingSnapshot(cursors.get("ratings.snapshot")));
    const removedRatingKeys = previousRatingKeys.filter((key) => !currentRatings.has(key));

    progressTotal =
      historyItems.length +
      watchlistStates.length +
      removedWatchlistKeys.length +
      ratingStates.length +
      removedRatingKeys.length;
    progressCurrent = 0;
    await updateSyncProgress(progress, {
      current: 0,
      label: progressTotal > 0 ? `Reconciling ${progressTotal} item(s)` : "Nothing to import",
      phase: "reconcile",
      total: progressTotal,
    });

    for (const item of historyItems) {
      const remoteMovie = toRemoteTraktMovieState(item.movie);

      if (!remoteMovie) {
        result.skipped += 1;
        progressCurrent += 1;
        await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "History");
        continue;
      }

      const localMovie = await resolveLocalMovie(remoteMovie);

      if (!localMovie) {
        result.skipped += 1;
        progressCurrent += 1;
        await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "History");
        continue;
      }

      await applyRemoteHistory(user.id, localMovie.id, item);
      result.historyImported += 1;
      progressCurrent += 1;
      await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "History");

      if (!newestWatchedAt || Date.parse(item.watched_at) > Date.parse(newestWatchedAt)) {
        newestWatchedAt = item.watched_at;
      }
    }

    if (newestWatchedAt) {
      await upsertSyncCursor(provider, "history.last_watched_at", newestWatchedAt);
    }

    for (const item of watchlistStates) {
      const localMovie = await resolveLocalMovie(item);

      if (!localMovie) {
        result.skipped += 1;
        progressCurrent += 1;
        await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "Watchlist");
        continue;
      }

      const imported = await applyRemoteWatchlist(user.id, localMovie.id, item);

      if (imported) {
        result.watchlistImported += 1;
      }

      progressCurrent += 1;
      await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "Watchlist");
    }

    for (const key of removedWatchlistKeys) {
      const movieId = await findLocalMovieIdByRemoteKey(key);

      if (!movieId || pendingMovieIds.has(movieId)) {
        progressCurrent += 1;
        await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "Watchlist");
        continue;
      }

      const removed = await removeRemoteMissingWatchlist(user.id, movieId);

      if (removed) {
        result.watchlistRemoved += 1;
      }

      progressCurrent += 1;
      await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "Watchlist");
    }

    await upsertSyncCursor(
      provider,
      "watchlist.snapshot",
      JSON.stringify(Array.from(currentWatchlistKeys).sort()),
    );

    for (const item of ratingStates) {
      const localMovie = await resolveLocalMovie(item);

      if (!localMovie) {
        result.skipped += 1;
        progressCurrent += 1;
        await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "Ratings");
        continue;
      }

      await applyRemoteRating(user.id, localMovie.id, item);
      result.ratingsImported += 1;
      progressCurrent += 1;
      await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "Ratings");
    }

    for (const key of removedRatingKeys) {
      const movieId = await findLocalMovieIdByRemoteKey(key);

      if (!movieId || pendingMovieIds.has(movieId)) {
        progressCurrent += 1;
        await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "Ratings");
        continue;
      }

      const cleared = await clearRemoteMissingRating(user.id, movieId);

      if (cleared) {
        result.ratingsCleared += 1;
      }

      progressCurrent += 1;
      await updateSyncProgressCheckpoint(progress, progressCurrent, progressTotal, "Ratings");
    }

    await upsertSyncCursor(
      provider,
      "ratings.snapshot",
      JSON.stringify(Object.fromEntries(Array.from(currentRatings.entries()).sort())),
    );

    const processedAt = new Date().toISOString();
    await upsertSyncCursor(provider, "last_pull_at", processedAt);
    await createSyncEvent({
      provider,
      direction: "pull",
      eventType: "trakt.pull.summary",
      status: "success",
      payload: result as unknown as Json,
      processedAt,
    });
    await updateSyncProgress(
      progress,
      {
        current: progressTotal,
        label: "Pull complete",
        phase: "complete",
        total: progressTotal,
      },
      "success",
    );

    return result;
  } catch (error) {
    await updateSyncProgress(
      progress,
      {
        current: progressCurrent,
        label: "Pull failed",
        phase: "error",
        total: progressTotal,
      },
      "error",
      getErrorMessage(error),
    );
    throw error;
  }
}

async function createSyncProgress(
  direction: SyncProgressDirection,
  payload: SyncProgressPayload,
) {
  return createSyncEvent({
    provider,
    direction,
    eventType: `trakt.${direction}.progress`,
    status: "pending",
    payload: toSyncProgressJson(payload),
    processedAt: new Date().toISOString(),
  });
}

async function updateSyncProgress(
  progress: SyncEvent,
  payload: SyncProgressPayload,
  status: "error" | "pending" | "success" = "pending",
  errorMessage: string | null = null,
) {
  await updateSyncEventStatus(progress.id, {
    errorMessage,
    payload: toSyncProgressJson(payload),
    processedAt: new Date().toISOString(),
    status,
  });
}

async function updateSyncProgressCheckpoint(
  progress: SyncEvent,
  current: number,
  total: number,
  label: string,
) {
  if (total > 20 && current !== total && current % 5 !== 0) {
    return;
  }

  await updateSyncProgress(progress, {
    current,
    label: `${label} ${current} of ${total}`,
    phase: "reconcile",
    total,
  });
}

function toSyncProgressJson(payload: SyncProgressPayload): Json {
  const current = Math.max(Math.floor(payload.current), 0);
  const total = Math.max(Math.floor(payload.total), 0);
  const percent = total > 0
    ? Math.min(Math.round((current / total) * 100), 100)
    : payload.phase === "complete"
      ? 100
      : 0;

  return {
    current,
    label: payload.label,
    percent,
    phase: payload.phase,
    total,
  };
}

async function pushSyncEvent(auth: TraktAuth, event: SyncEvent) {
  const payload = readRecord(event.payload);

  if (event.event_type === "movie.tag.add" || event.event_type === "movie.tag.remove") {
    return {
      skipped: true,
      reason: "Trakt does not expose app tag sync for movies.",
    };
  }

  const movieId = readString(payload.movieId, "movieId");
  const { mappings, movie } = await loadMovieForPush(movieId);

  switch (event.event_type) {
    case "movie.mark_watched":
    case "movie.add_watch_date": {
      const watchedAt = readString(payload.watchedAt, "watchedAt");
      return addTraktHistory(auth, {
        movies: [toTraktHistoryMovie(movie, watchedAt, mappings)],
      });
    }
    case "movie.add_to_watchlist":
      return addTraktWatchlist(auth, {
        movies: [toTraktSyncMovie(movie, mappings)],
      });
    case "movie.remove_from_watchlist":
      return removeTraktWatchlist(auth, {
        movies: [toTraktSyncMovie(movie, mappings)],
      });
    case "movie.remove_from_library":
      return removeTraktHistory(auth, {
        movies: [toTraktSyncMovie(movie, mappings)],
      });
    case "movie.rating.set": {
      const personalRating = readNumber(payload.personalRating, "personalRating");

      if (personalRating < 1) {
        return removeTraktRatings(auth, {
          movies: [toTraktSyncMovie(movie, mappings)],
        });
      }

      return setTraktRatings(auth, {
        movies: [
          toTraktRatedMovie(
            movie,
            Math.min(Math.max(Math.round(personalRating), 1), 10),
            event.created_at,
            mappings,
          ),
        ],
      });
    }
    case "movie.rating.clear":
      return removeTraktRatings(auth, {
        movies: [toTraktSyncMovie(movie, mappings)],
      });
    default:
      throw new AppError(`Unsupported Trakt sync event: ${event.event_type}`, {
        code: "UNSUPPORTED_SYNC_EVENT",
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

async function listAllHistory(auth: TraktAuth, startAt: string | null) {
  const items: TraktHistoryMovie[] = [];

  for (let page = 1; page <= maxHistoryPages; page += 1) {
    const pageItems = await listTraktHistoryMovies(auth, {
      page,
      limit: pageLimit,
      startAt,
    });

    items.push(...pageItems);

    if (pageItems.length < pageLimit) {
      break;
    }
  }

  return items;
}

async function listAllWatchlist(auth: TraktAuth) {
  const items = [];

  for (let page = 1; page <= maxWatchlistPages; page += 1) {
    const pageItems = await listTraktWatchlistMovies(auth, {
      page,
      limit: pageLimit,
    });

    items.push(...pageItems);

    if (pageItems.length < pageLimit) {
      break;
    }
  }

  return items;
}

async function resolveLocalMovie(remoteMovie: RemoteTraktMovieState): Promise<Movie | null> {
  const supabase = createSupabaseAdminClient();
  const mappedMovieId = await findMappedMovieId(remoteMovie);

  if (mappedMovieId) {
    const movie = await loadMovie(mappedMovieId);

    if (movie) {
      await replaceProviderMappings(movie.id, remoteMovie);
      return movie;
    }
  }

  if (remoteMovie.tmdbId) {
    const { data: existingByTmdb, error: existingByTmdbError } = await supabase
      .from("movies")
      .select("*")
      .eq("tmdb_id", remoteMovie.tmdbId)
      .maybeSingle();

    if (existingByTmdbError) {
      throwDatabaseError("Failed to resolve TMDB movie mapping.", existingByTmdbError);
    }

    if (existingByTmdb) {
      await replaceProviderMappings(existingByTmdb.id, remoteMovie);
      return existingByTmdb;
    }

    const movie = await upsertMinimalTraktMovie(remoteMovie);
    await replaceProviderMappings(movie.id, remoteMovie);
    return movie;
  }

  if (remoteMovie.imdbId) {
    const { data: existingByImdb, error: existingByImdbError } = await supabase
      .from("movies")
      .select("*")
      .eq("imdb_id", remoteMovie.imdbId)
      .maybeSingle();

    if (existingByImdbError) {
      throwDatabaseError("Failed to resolve IMDb movie mapping.", existingByImdbError);
    }

    if (existingByImdb) {
      await replaceProviderMappings(existingByImdb.id, remoteMovie);
      return existingByImdb;
    }
  }

  return null;
}

async function upsertMinimalTraktMovie(remoteMovie: RemoteTraktMovieState) {
  if (!remoteMovie.tmdbId) {
    throw new AppError("Cannot create a Trakt movie without a TMDB id.", {
      code: "TRAKT_MOVIE_TMDB_ID_MISSING",
      status: 422,
    });
  }

  const supabase = createSupabaseAdminClient();
  const title = remoteMovie.title?.trim() || `TMDB ${remoteMovie.tmdbId}`;
  const movie: MovieInsert = {
    imdb_id: remoteMovie.imdbId,
    title,
    tmdb_id: remoteMovie.tmdbId,
  };

  const { data, error } = await supabase
    .from("movies")
    .upsert(movie, { onConflict: "tmdb_id" })
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to bootstrap Trakt movie metadata.", error);
  }

  return data;
}

async function findMappedMovieId(remoteMovie: RemoteTraktMovieState) {
  const candidates: Array<{ provider: "imdb" | "tmdb" | "trakt"; id: string }> = [];

  if (remoteMovie.traktId) {
    candidates.push({ provider: "trakt", id: remoteMovie.traktId });
  }

  if (remoteMovie.tmdbId) {
    candidates.push({ provider: "tmdb", id: String(remoteMovie.tmdbId) });
  }

  if (remoteMovie.imdbId) {
    candidates.push({ provider: "imdb", id: remoteMovie.imdbId });
  }

  for (const candidate of candidates) {
    const movieId = await findMovieIdByProvider(candidate.provider, candidate.id);

    if (movieId) {
      return movieId;
    }
  }

  return null;
}

async function findMovieIdByProvider(providerName: "imdb" | "tmdb" | "trakt", id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("provider_mappings")
    .select("movie_id")
    .eq("provider", providerName)
    .eq("provider_movie_id", id)
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to load provider mapping.", error);
  }

  return data?.movie_id ?? null;
}

async function findLocalMovieIdByRemoteKey(key: string) {
  const [providerName, id] = key.split(":", 2);

  if (
    !id ||
    (providerName !== "trakt" && providerName !== "tmdb" && providerName !== "imdb")
  ) {
    return null;
  }

  return findMovieIdByProvider(providerName, id);
}

async function loadMovie(movieId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("movies")
    .select("*")
    .eq("id", movieId)
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to load movie.", error);
  }

  return data;
}

async function replaceProviderMappings(movieId: string, remoteMovie: RemoteTraktMovieState) {
  const supabase = createSupabaseAdminClient();
  const mappings: ProviderMappingInsert[] = [];
  const providers: Array<"imdb" | "tmdb" | "trakt"> = [];

  if (remoteMovie.traktId) {
    providers.push("trakt");
    mappings.push({
      movie_id: movieId,
      provider: "trakt",
      provider_movie_id: remoteMovie.traktId,
    });
  }

  if (remoteMovie.tmdbId) {
    providers.push("tmdb");
    mappings.push({
      movie_id: movieId,
      provider: "tmdb",
      provider_movie_id: String(remoteMovie.tmdbId),
    });
  }

  if (remoteMovie.imdbId) {
    providers.push("imdb");
    mappings.push({
      movie_id: movieId,
      provider: "imdb",
      provider_movie_id: remoteMovie.imdbId,
    });
  }

  if (providers.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("provider_mappings")
    .delete()
    .eq("movie_id", movieId)
    .in("provider", providers);

  if (deleteError) {
    throwDatabaseError("Failed to replace Trakt provider mappings.", deleteError);
  }

  const { error: mappingError } = await supabase
    .from("provider_mappings")
    .upsert(mappings, { onConflict: "provider,provider_movie_id" });

  if (mappingError) {
    throwDatabaseError("Failed to upsert Trakt provider mappings.", mappingError);
  }
}

async function applyRemoteHistory(userId: string, movieId: string, item: TraktHistoryMovie) {
  const supabase = createSupabaseAdminClient();
  const providerEventId = `trakt:history:${item.id}`;
  const { data: existingLog, error: existingLogError } = await supabase
    .from("watch_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  if (existingLogError) {
    throwDatabaseError("Failed to check existing Trakt watch log.", existingLogError);
  }

  const existingUserMovie = await loadUserMovie(userId, movieId);

  const { error: userMovieError } = await supabase.from("user_movies").upsert(
    {
      user_id: userId,
      movie_id: movieId,
      status: "watched",
      watchlisted_at: null,
      last_watched_at: latestTimestamp(existingUserMovie?.last_watched_at, item.watched_at),
      personal_rating: existingUserMovie?.personal_rating ?? null,
    },
    { onConflict: "user_id,movie_id" },
  );

  if (userMovieError) {
    throwDatabaseError("Failed to apply Trakt watched state.", userMovieError);
  }

  if (existingLog) {
    return;
  }

  const { error: watchLogError } = await supabase.from("watch_logs").insert({
    user_id: userId,
    movie_id: movieId,
    watched_at: item.watched_at,
    source: "trakt_sync",
    provider_event_id: providerEventId,
  });

  if (watchLogError) {
    throwDatabaseError("Failed to import Trakt watch history.", watchLogError);
  }
}

async function applyRemoteWatchlist(
  userId: string,
  movieId: string,
  item: RemoteTraktWatchlistState,
) {
  const existingUserMovie = await loadUserMovie(userId, movieId);

  if (existingUserMovie?.status === "watched") {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("user_movies").upsert(
    {
      user_id: userId,
      movie_id: movieId,
      status: "to_watch",
      watchlisted_at: item.listedAt,
      last_watched_at: null,
      personal_rating: existingUserMovie?.personal_rating ?? null,
    },
    { onConflict: "user_id,movie_id" },
  );

  if (error) {
    throwDatabaseError("Failed to import Trakt watchlist state.", error);
  }

  return true;
}

async function removeRemoteMissingWatchlist(userId: string, movieId: string) {
  const existingUserMovie = await loadUserMovie(userId, movieId);

  if (existingUserMovie?.status !== "to_watch") {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("user_movies")
    .delete()
    .eq("user_id", userId)
    .eq("movie_id", movieId);

  if (error) {
    throwDatabaseError("Failed to reconcile removed Trakt watchlist item.", error);
  }

  return true;
}

async function applyRemoteRating(
  userId: string,
  movieId: string,
  item: RemoteTraktRatingState,
) {
  const existingUserMovie = await loadUserMovie(userId, movieId);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("user_movies").upsert(
    {
      user_id: userId,
      movie_id: movieId,
      status: existingUserMovie?.status ?? "watched",
      watchlisted_at: existingUserMovie?.watchlisted_at ?? null,
      last_watched_at: existingUserMovie?.last_watched_at ?? null,
      personal_rating: item.rating,
    },
    { onConflict: "user_id,movie_id" },
  );

  if (error) {
    throwDatabaseError("Failed to import Trakt rating.", error);
  }
}

async function clearRemoteMissingRating(userId: string, movieId: string) {
  const existingUserMovie = await loadUserMovie(userId, movieId);

  if (!existingUserMovie || existingUserMovie.personal_rating === null) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("user_movies")
    .update({ personal_rating: null })
    .eq("user_id", userId)
    .eq("movie_id", movieId);

  if (error) {
    throwDatabaseError("Failed to reconcile removed Trakt rating.", error);
  }

  return true;
}

async function loadUserMovie(userId: string, movieId: string): Promise<UserMovie | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_movies")
    .select("*")
    .eq("user_id", userId)
    .eq("movie_id", movieId)
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to load user movie state.", error);
  }

  return data;
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

function parseStringArrayCursor(value: string | undefined) {
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

function parseRatingSnapshot(value: string | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function latestTimestamp(left: string | null | undefined, right: string) {
  if (!left) {
    return right;
  }

  return Date.parse(left) > Date.parse(right) ? left : right;
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
