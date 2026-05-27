import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { ingestPreparedTmdbShow } from "@/lib/db/mutations/media";
import { ingestTmdbMovie } from "@/lib/db/mutations/movies";
import type { MediaItem, Movie } from "@/lib/db/types";
import { AppError, getErrorMessage, isAppError } from "@/lib/errors";
import {
  getTmdbMovieCreditsWithAuth,
  getTmdbMovieDetailsWithAuth,
  getTmdbTvDetailsWithAuth,
  getTmdbTvSeasonDetailsWithAuth,
  loadTmdbAuthForCurrentUser,
  loadTmdbAuthForUser,
  type TmdbAuth,
} from "@/lib/providers/tmdb/client";
import { toTmdbShowIngestPayload } from "@/lib/providers/tmdb/adapters";
import {
  needsTmdbMetadataEnrichment,
  normalizeTmdbBackfillLimit,
} from "@/lib/providers/tmdb/enrichment-state";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type TmdbMetadataBackfillResult = {
  enriched: number;
  failed: number;
  failureSamples: string[];
  processed: number;
  remaining: number;
  skipped: number;
};

type TmdbBackfillOptions = {
  limit?: number | null;
  scanLimit?: number | null;
};

type TmdbOnDemandEnrichmentOptions = {
  auth?: TmdbAuth;
};

type TmdbEnrichmentCandidate = {
  movie: Movie;
  tmdbId: number;
};
type TmdbShowEnrichmentCandidate = {
  seasonNumbers: number[];
  show: MediaItem;
  tmdbId: number;
};

const defaultBackfillLimit = 20;
const defaultScanLimit = 500;
const failureSampleLimit = 5;
const dbReadChunkSize = 500;

export async function backfillCurrentUserTmdbMetadata(
  options: TmdbBackfillOptions = {},
): Promise<TmdbMetadataBackfillResult> {
  const user = await requireUser();
  const auth = await loadTmdbAuthForUser(user.id);
  const limit = normalizeTmdbBackfillLimit(options.limit, defaultBackfillLimit);
  const scanLimit = normalizeTmdbBackfillScanLimit(options.scanLimit);
  const [movieCandidates, showCandidates] = await Promise.all([
    listCurrentUserTmdbEnrichmentCandidates(user.id, {
      limit: scanLimit,
      scanLimit,
    }),
    listCurrentUserTmdbShowEnrichmentCandidates(user.id, {
      limit: scanLimit,
      scanLimit,
    }),
  ]);
  const selectedShowCandidates = showCandidates.slice(0, limit);
  const selectedMovieCandidates = movieCandidates.slice(
    0,
    Math.max(limit - selectedShowCandidates.length, 0),
  );
  const selectedCount = selectedShowCandidates.length + selectedMovieCandidates.length;
  const candidateCount = movieCandidates.length + showCandidates.length;
  const candidates = selectedMovieCandidates;
  const showCandidatesToEnrich = selectedShowCandidates;
  const result: TmdbMetadataBackfillResult = {
    enriched: 0,
    failed: 0,
    failureSamples: [],
    processed: 0,
    remaining: Math.max(candidateCount - selectedCount, 0),
    skipped: 0,
  };

  for (const candidate of showCandidatesToEnrich) {
    result.processed += 1;

    try {
      const enriched = await enrichTmdbShowMetadataCandidate(candidate, auth);

      if (enriched) {
        result.enriched += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      recordBackfillFailure(result, candidate.tmdbId, error);
    }
  }

  for (const candidate of candidates) {
    result.processed += 1;

    try {
      const enriched = await enrichTmdbMetadataCandidate(candidate, auth);

      if (enriched) {
        result.enriched += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      recordBackfillFailure(result, candidate.tmdbId, error);
    }
  }

  return result;
}

export async function enrichTmdbMovieOnDemand(
  movie: Movie,
  options: TmdbOnDemandEnrichmentOptions = {},
): Promise<Movie> {
  if (!needsTmdbMetadataEnrichment(movie)) {
    return movie;
  }

  try {
    const auth = options.auth ?? await loadTmdbAuthForCurrentUser();
    return await enrichTmdbMovieMetadata(movie.tmdb_id, auth);
  } catch (error) {
    if (isExpectedLazyEnrichmentError(error)) {
      return movie;
    }

    console.error("Lazy TMDB metadata enrichment failed", {
      error,
      movieId: movie.id,
      tmdbId: movie.tmdb_id,
    });
    return movie;
  }
}

export async function enrichTmdbMovieMetadata(
  tmdbId: number,
  auth: TmdbAuth,
): Promise<Movie> {
  validateTmdbId(tmdbId);
  const [detail, credits] = await Promise.all([
    getTmdbMovieDetailsWithAuth(auth, tmdbId),
    getTmdbMovieCreditsWithAuth(auth, tmdbId),
  ]);

  return ingestTmdbMovie(detail, credits);
}

async function enrichTmdbMetadataCandidate(
  candidate: TmdbEnrichmentCandidate,
  auth: TmdbAuth,
) {
  if (!needsTmdbMetadataEnrichment(candidate.movie)) {
    return false;
  }

  await enrichTmdbMovieMetadata(candidate.tmdbId, auth);
  return true;
}

async function enrichTmdbShowMetadataCandidate(
  candidate: TmdbShowEnrichmentCandidate,
  auth: TmdbAuth,
) {
  if (candidate.show.tmdb_enriched_at) {
    return false;
  }

  const detail = await getTmdbTvDetailsWithAuth(auth, candidate.tmdbId);
  const seasons = await Promise.all(
    candidate.seasonNumbers.map((seasonNumber) =>
      getTmdbTvSeasonDetailsWithAuth(auth, candidate.tmdbId, seasonNumber),
    ),
  );

  await ingestPreparedTmdbShow(toTmdbShowIngestPayload(detail, seasons));
  return true;
}

async function listCurrentUserTmdbEnrichmentCandidates(
  userId: string,
  options: {
    limit: number;
    scanLimit: number;
  },
) {
  const movieIds = await loadCurrentUserMovieIds(userId);

  if (movieIds.length === 0) {
    return [];
  }

  const unenrichedMovies = await loadUnenrichedMoviesByIds(movieIds, options.scanLimit);
  const mappingsByMovieId = await loadTmdbMappingsByMovieId(unenrichedMovies.map((m) => m.id));
  const candidates: TmdbEnrichmentCandidate[] = [];

  for (const movie of unenrichedMovies) {
    const tmdbId = mappingsByMovieId.get(movie.id);

    if (!tmdbId || movie.tmdb_id !== tmdbId || !needsTmdbMetadataEnrichment(movie)) {
      continue;
    }

    candidates.push({ movie, tmdbId });
  }

  return candidates;
}

async function listCurrentUserTmdbShowEnrichmentCandidates(
  userId: string,
  options: {
    limit: number;
    scanLimit: number;
  },
) {
  const showIds = await loadCurrentUserShowIds(userId);

  if (showIds.length === 0) {
    return [];
  }

  const unenrichedShows = await loadUnenrichedShowsByIds(showIds, options.scanLimit);
  const [mappingsByShowId, watchedSeasonsByShowId] = await Promise.all([
    loadTmdbMappingsByMediaId(unenrichedShows.map((show) => show.id)),
    loadWatchedSeasonNumbersByShowId(userId, unenrichedShows.map((show) => show.id)),
  ]);
  const candidates: TmdbShowEnrichmentCandidate[] = [];

  for (const show of unenrichedShows) {
    const tmdbId = mappingsByShowId.get(show.id);

    if (!tmdbId || show.tmdb_enriched_at) {
      continue;
    }

    candidates.push({
      seasonNumbers: watchedSeasonsByShowId.get(show.id) ?? [],
      show,
      tmdbId,
    });
  }

  return candidates.sort((a, b) => {
    const watchedDelta = Number(b.seasonNumbers.length > 0) - Number(a.seasonNumbers.length > 0);

    if (watchedDelta !== 0) {
      return watchedDelta;
    }

    return a.show.title.localeCompare(b.show.title);
  });
}

async function loadCurrentUserMovieIds(userId: string) {
  const supabase = createSupabaseAdminClient();
  const [libraryResult, tagResult] = await Promise.all([
    supabase.from("user_movies").select("movie_id").eq("user_id", userId),
    supabase.from("user_movie_tags").select("movie_id").eq("user_id", userId),
  ]);

  if (libraryResult.error) {
    throwDatabaseError("Failed to load TMDB backfill library candidates.", libraryResult.error);
  }

  if (tagResult.error) {
    throwDatabaseError("Failed to load TMDB backfill tag candidates.", tagResult.error);
  }

  return uniqueArray([
    ...(libraryResult.data ?? []).map((row) => row.movie_id),
    ...(tagResult.data ?? []).map((row) => row.movie_id),
  ]);
}

async function loadCurrentUserShowIds(userId: string) {
  const supabase = createSupabaseAdminClient();
  const [libraryResult, tagResult] = await Promise.all([
    supabase.from("user_media").select("media_id").eq("user_id", userId),
    supabase.from("user_media_tags").select("media_id").eq("user_id", userId),
  ]);

  if (libraryResult.error) {
    throwDatabaseError("Failed to load TMDB show backfill library candidates.", libraryResult.error);
  }

  if (tagResult.error) {
    throwDatabaseError("Failed to load TMDB show backfill tag candidates.", tagResult.error);
  }

  return uniqueArray([
    ...(libraryResult.data ?? []).map((row) => row.media_id),
    ...(tagResult.data ?? []).map((row) => row.media_id),
  ]);
}

async function loadUnenrichedMoviesByIds(movieIds: string[], limit: number) {
  const movies: Movie[] = [];
  const supabase = createSupabaseAdminClient();

  for (const chunk of chunkArray(uniqueArray(movieIds), dbReadChunkSize)) {
    if (movies.length >= limit) break;

    const { data, error } = await supabase
      .from("movies")
      .select("*")
      .in("id", chunk)
      .is("tmdb_enriched_at", null)
      .limit(limit - movies.length);

    if (error) {
      throwDatabaseError("Failed to load unenriched TMDB backfill movies.", error);
    }

    movies.push(...(data ?? []));
  }

  return movies;
}

async function loadUnenrichedShowsByIds(showIds: string[], limit: number) {
  const shows: MediaItem[] = [];
  const supabase = createSupabaseAdminClient();

  for (const chunk of chunkArray(uniqueArray(showIds), dbReadChunkSize)) {
    if (shows.length >= limit) break;

    const { data, error } = await supabase
      .from("media_items")
      .select("*")
      .in("id", chunk)
      .eq("type", "show")
      .is("tmdb_enriched_at", null)
      .limit(limit - shows.length);

    if (error) {
      throwDatabaseError("Failed to load unenriched TMDB show backfill items.", error);
    }

    shows.push(...((data ?? []) as MediaItem[]));
  }

  return shows;
}

async function loadTmdbMappingsByMovieId(movieIds: Iterable<string>) {
  const mappings = new Map<string, number>();
  const supabase = createSupabaseAdminClient();

  for (const movieIdChunk of chunkArray(uniqueArray(movieIds), dbReadChunkSize)) {
    const { data, error } = await supabase
      .from("provider_mappings")
      .select("movie_id, provider_movie_id")
      .eq("provider", "tmdb")
      .in("movie_id", movieIdChunk);

    if (error) {
      throwDatabaseError("Failed to load TMDB provider mappings for backfill.", error);
    }

    for (const mapping of data ?? []) {
      const tmdbId = Number(mapping.provider_movie_id);

      if (Number.isInteger(tmdbId) && tmdbId > 0) {
        mappings.set(mapping.movie_id, tmdbId);
      }
    }
  }

  return mappings;
}

async function loadTmdbMappingsByMediaId(mediaIds: Iterable<string>) {
  const mappings = new Map<string, number>();
  const supabase = createSupabaseAdminClient();

  for (const mediaIdChunk of chunkArray(uniqueArray(mediaIds), dbReadChunkSize)) {
    const { data, error } = await supabase
      .from("media_provider_mappings")
      .select("media_id, provider_id")
      .eq("provider", "tmdb")
      .eq("provider_media_type", "show")
      .in("media_id", mediaIdChunk);

    if (error) {
      throwDatabaseError("Failed to load TMDB show provider mappings for backfill.", error);
    }

    for (const mapping of data ?? []) {
      const tmdbId = Number(mapping.provider_id);

      if (mapping.media_id && Number.isInteger(tmdbId) && tmdbId > 0) {
        mappings.set(mapping.media_id, tmdbId);
      }
    }
  }

  return mappings;
}

async function loadWatchedSeasonNumbersByShowId(userId: string, showIds: string[]) {
  const seasonsByShowId = new Map<string, number[]>();
  const episodeIdsByShowId = new Map<string, string[]>();
  const supabase = createSupabaseAdminClient();

  for (const showIdChunk of chunkArray(uniqueArray(showIds), dbReadChunkSize)) {
    const { data, error } = await supabase
      .from("media_watch_activity")
      .select("media_id, episode_id")
      .eq("user_id", userId)
      .in("media_id", showIdChunk)
      .not("episode_id", "is", null);

    if (error) {
      throwDatabaseError("Failed to load watched show episode candidates.", error);
    }

    for (const row of data ?? []) {
      if (!row.episode_id) {
        continue;
      }

      const episodeIds = episodeIdsByShowId.get(row.media_id) ?? [];

      episodeIds.push(row.episode_id);
      episodeIdsByShowId.set(row.media_id, episodeIds);
    }
  }

  const episodeIds = uniqueArray(
    Array.from(episodeIdsByShowId.values()).flat(),
  );
  const seasonByEpisodeId = new Map<string, number>();

  for (const episodeIdChunk of chunkArray(episodeIds, dbReadChunkSize)) {
    const { data, error } = await supabase
      .from("episodes")
      .select("id, season_number")
      .in("id", episodeIdChunk);

    if (error) {
      throwDatabaseError("Failed to load watched show episode seasons.", error);
    }

    for (const row of data ?? []) {
      seasonByEpisodeId.set(row.id, row.season_number);
    }
  }

  for (const [showId, ids] of episodeIdsByShowId.entries()) {
    const seasons = uniqueArray(
      ids
        .map((episodeId) => seasonByEpisodeId.get(episodeId))
        .filter((seasonNumber): seasonNumber is number =>
          typeof seasonNumber === "number" && Number.isInteger(seasonNumber) && seasonNumber >= 0,
        ),
    ).sort((a, b) => a - b);

    seasonsByShowId.set(showId, seasons);
  }

  return seasonsByShowId;
}


function normalizeTmdbBackfillScanLimit(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return defaultScanLimit;
  }

  return Math.min(Math.max(value, 1), 2000);
}

function validateTmdbId(tmdbId: number) {
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    throw new AppError("Invalid TMDB movie id.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }
}

function isExpectedLazyEnrichmentError(error: unknown) {
  if (!isAppError(error)) {
    return false;
  }

  return (
    error.code === "TMDB_TOKEN_MISSING" ||
    error.code === "HTTP_ERROR" ||
    error.code === "NETWORK_ERROR"
  );
}

function recordBackfillFailure(
  result: TmdbMetadataBackfillResult,
  tmdbId: number,
  error: unknown,
) {
  result.failed += 1;

  if (result.failureSamples.length >= failureSampleLimit) {
    return;
  }

  result.failureSamples.push(`tmdb:${tmdbId}: ${getErrorMessage(error)}`);
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
