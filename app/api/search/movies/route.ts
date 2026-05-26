import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import type { MediaStatus, MovieStatus } from "@/lib/db/types";
import { isAppError } from "@/lib/errors";
import {
  checkRateLimit,
  rateLimitResponse,
  requestRateLimitKey,
} from "@/lib/rate-limit";
import { searchTmdbMovies, searchTmdbTv } from "@/lib/providers/tmdb/client";
import {
  type MediaSearchResult,
  type LocalMediaSearchState,
  type LocalMovieSearchState,
  toMovieSearchResponse,
  toTvSearchResponse,
} from "@/lib/providers/tmdb/adapters";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LocalMovieRow = {
  id: string;
  tmdb_id: number;
};

type UserMovieStateRow = {
  movie_id: string;
  status: MovieStatus;
  personal_rating: number | null;
};

type LocalShowMappingRow = {
  media_id: string | null;
  provider_id: string;
};

type UserMediaStateRow = {
  media_id: string;
  status: MediaStatus;
  personal_rating: number | null;
};

const minimumQueryLength = 2;
const maximumQueryLength = 120;
const maximumTmdbPage = 500;
const languagePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to search movies." },
        { status: 401 },
      );
    }

    const query = normalizeQuery(request.nextUrl.searchParams.get("q"));
    const page = normalizePage(request.nextUrl.searchParams.get("page"));
    const language = normalizeLanguage(request.nextUrl.searchParams.get("language"));
    const retryAfter = checkRateLimit({
      key: requestRateLimitKey(request, "tmdb-search", user.id),
      limit: 60,
      windowMs: 60 * 1000,
    });

    if (retryAfter) {
      return rateLimitResponse(retryAfter);
    }

    if (query.length < minimumQueryLength) {
      return NextResponse.json(
        {
          error: `Search query must be at least ${minimumQueryLength} characters.`,
        },
        { status: 400 },
      );
    }

    const [movieResponse, tvResponse] = await Promise.all([
      searchTmdbMovies({ query, page, language }),
      searchTmdbTv({ query, page, language }),
    ]);
    const [localMovieStateByTmdbId, localShowStateByTmdbId] = await Promise.all([
      loadLocalMovieState(
        movieResponse.results.map((result) => result.id),
        user.id,
      ),
      loadLocalShowState(
        tvResponse.results.map((result) => result.id),
        user.id,
      ),
    ]);
    const movieSearchResponse = toMovieSearchResponse(
      query,
      movieResponse,
      localMovieStateByTmdbId,
    );
    const tvSearchResponse = toTvSearchResponse(query, tvResponse, localShowStateByTmdbId);

    return NextResponse.json(
      {
        query,
        page,
        totalPages: Math.max(movieSearchResponse.totalPages, tvSearchResponse.totalPages),
        totalResults: movieSearchResponse.totalResults + tvSearchResponse.totalResults,
        results: [...movieSearchResponse.results, ...tvSearchResponse.results].sort((left, right) =>
          compareSearchResults(query, left, right),
        ),
      },
    );
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Failed to search movies." },
      { status: 500 },
    );
  }
}

function compareSearchResults(
  query: string,
  left: MediaSearchResult,
  right: MediaSearchResult,
) {
  return searchScore(query, right) - searchScore(query, left);
}

function searchScore(query: string, result: MediaSearchResult) {
  const normalizedQuery = normalizeSearchText(query);
  const title = normalizeSearchText(result.title);
  const originalTitle = normalizeSearchText(result.originalTitle);
  const exactMatch = title === normalizedQuery || originalTitle === normalizedQuery;
  const startsWithMatch = title.startsWith(normalizedQuery) || originalTitle.startsWith(normalizedQuery);
  const includesMatch = title.includes(normalizedQuery) || originalTitle.includes(normalizedQuery);

  return (
    (result.alreadyInLibrary ? 100_000 : 0) +
    (exactMatch ? 50_000 : 0) +
    (startsWithMatch ? 10_000 : 0) +
    (includesMatch ? 2_500 : 0) +
    (result.popularity ?? 0)
  );
}

function normalizeSearchText(value: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeQuery(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maximumQueryLength);
}

function normalizePage(value: string | null) {
  if (!value) {
    return 1;
  }

  const page = Number(value);

  if (!Number.isInteger(page)) {
    return 1;
  }

  return Math.min(Math.max(page, 1), maximumTmdbPage);
}

function normalizeLanguage(value: string | null) {
  if (!value) {
    return null;
  }

  return languagePattern.test(value) ? value : null;
}

async function loadLocalMovieState(tmdbIds: number[], userId: string) {
  const uniqueTmdbIds = Array.from(new Set(tmdbIds));

  if (uniqueTmdbIds.length === 0) {
    return new Map<number, LocalMovieSearchState>();
  }

  const supabase = await createSupabaseServerClient();
  const { data: movies, error: moviesError } = await supabase
    .from("movies")
    .select("id, tmdb_id")
    .in("tmdb_id", uniqueTmdbIds);

  if (moviesError) {
    throwDatabaseError("Failed to load local movie matches.", moviesError);
  }

  const movieRows = (movies ?? []) as LocalMovieRow[];

  if (movieRows.length === 0) {
    return new Map<number, LocalMovieSearchState>();
  }

  const localStateByTmdbId = new Map<number, LocalMovieSearchState>();
  const movieIdByLocalId = new Map(movieRows.map((movie) => [movie.id, movie.tmdb_id]));
  const { data: userMovies, error: userMoviesError } = await supabase
    .from("user_movies")
    .select("movie_id, status, personal_rating")
    .eq("user_id", userId)
    .in("movie_id", movieRows.map((movie) => movie.id));

  if (userMoviesError) {
    throwDatabaseError("Failed to load local user movie state.", userMoviesError);
  }

  ((userMovies ?? []) as UserMovieStateRow[]).forEach((userMovie) => {
    const tmdbId = movieIdByLocalId.get(userMovie.movie_id);

    if (!tmdbId) {
      return;
    }

    localStateByTmdbId.set(tmdbId, {
      localMovieId: userMovie.movie_id,
      currentStatus: userMovie.status,
      personalRating: userMovie.personal_rating,
    });
  });

  return localStateByTmdbId;
}

async function loadLocalShowState(tmdbIds: number[], userId: string) {
  const uniqueTmdbIds = Array.from(new Set(tmdbIds));

  if (uniqueTmdbIds.length === 0) {
    return new Map<number, LocalMediaSearchState>();
  }

  const supabase = await createSupabaseServerClient();
  const { data: mappings, error: mappingsError } = await supabase
    .from("media_provider_mappings")
    .select("media_id, provider_id")
    .eq("provider", "tmdb")
    .eq("provider_media_type", "show")
    .in("provider_id", uniqueTmdbIds.map(String));

  if (mappingsError) {
    throwDatabaseError("Failed to load local show matches.", mappingsError);
  }

  const mappingRows = ((mappings ?? []) as LocalShowMappingRow[]).filter(
    (mapping) => mapping.media_id,
  );

  if (mappingRows.length === 0) {
    return new Map<number, LocalMediaSearchState>();
  }

  const tmdbIdByMediaId = new Map(
    mappingRows.map((mapping) => [mapping.media_id as string, Number(mapping.provider_id)]),
  );
  const { data: userMedia, error: userMediaError } = await supabase
    .from("user_media")
    .select("media_id, status, personal_rating")
    .eq("user_id", userId)
    .in("media_id", Array.from(tmdbIdByMediaId.keys()));

  if (userMediaError) {
    throwDatabaseError("Failed to load local user show state.", userMediaError);
  }

  const localStateByTmdbId = new Map<number, LocalMediaSearchState>();
  ((userMedia ?? []) as UserMediaStateRow[]).forEach((row) => {
    const tmdbId = tmdbIdByMediaId.get(row.media_id);

    if (!tmdbId) {
      return;
    }

    localStateByTmdbId.set(tmdbId, {
      localMediaId: row.media_id,
      currentStatus: row.status,
      personalRating: row.personal_rating,
    });
  });

  return localStateByTmdbId;
}
