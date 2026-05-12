import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import type { MovieStatus } from "@/lib/db/types";
import { isAppError } from "@/lib/errors";
import {
  checkRateLimit,
  rateLimitResponse,
  requestRateLimitKey,
} from "@/lib/rate-limit";
import { searchTmdbMovies } from "@/lib/providers/tmdb/client";
import {
  type LocalMovieSearchState,
  toMovieSearchResponse,
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

    const tmdbResponse = await searchTmdbMovies({ query, page, language });
    const localStateByTmdbId = await loadLocalMovieState(
      tmdbResponse.results.map((result) => result.id),
      user.id,
    );

    return NextResponse.json(
      toMovieSearchResponse(query, tmdbResponse, localStateByTmdbId),
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
