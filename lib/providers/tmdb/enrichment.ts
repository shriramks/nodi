import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { ingestTmdbMovie } from "@/lib/db/mutations/movies";
import type { Movie } from "@/lib/db/types";
import { AppError, getErrorMessage, isAppError } from "@/lib/errors";
import {
  getTmdbMovieCreditsWithAuth,
  getTmdbMovieDetailsWithAuth,
  loadTmdbAuthForUser,
  type TmdbAuth,
} from "@/lib/providers/tmdb/client";
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

type TmdbEnrichmentCandidate = {
  movie: Movie;
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
  const candidates = await listCurrentUserTmdbEnrichmentCandidates(user.id, {
    limit: scanLimit,
    scanLimit,
  });
  const selectedCandidates = candidates.slice(0, limit);
  const result: TmdbMetadataBackfillResult = {
    enriched: 0,
    failed: 0,
    failureSamples: [],
    processed: 0,
    remaining: Math.max(candidates.length - selectedCandidates.length, 0),
    skipped: 0,
  };

  for (const candidate of selectedCandidates) {
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

export async function enrichTmdbMovieOnDemand(movie: Movie): Promise<Movie> {
  if (!needsTmdbMetadataEnrichment(movie)) {
    return movie;
  }

  try {
    const user = await requireUser();
    const auth = await loadTmdbAuthForUser(user.id);
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
