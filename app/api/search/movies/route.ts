import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { loadLocalMovieState, loadLocalShowState } from "@/lib/db/queries/search-local-state";
import { isAppError } from "@/lib/errors";
import {
  checkRateLimit,
  rateLimitResponse,
  requestRateLimitKey,
} from "@/lib/rate-limit";
import { searchTmdbMovies, searchTmdbTv } from "@/lib/providers/tmdb/client";
import {
  type MediaSearchResult,
  toMovieSearchResponse,
  toTvSearchResponse,
} from "@/lib/providers/tmdb/adapters";

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
