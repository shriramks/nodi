import "server-only";

import { requireUser } from "@/lib/auth/server";
import { fetchJson } from "@/lib/fetch";
import { AppError } from "@/lib/errors";
import { readProviderSecret } from "@/lib/providers/credentials";

const tmdbBaseUrl = "https://api.themoviedb.org/3";

export type TmdbMovieSearchResult = {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  original_language?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
};

export type TmdbMovieSearchResponse = {
  page: number;
  results: TmdbMovieSearchResult[];
  total_pages: number;
  total_results: number;
};

export type TmdbMovieDetails = {
  id: number;
  imdb_id?: string | null;
  title: string;
  original_title?: string | null;
  release_date?: string | null;
  original_language?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  runtime?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  popularity?: number | null;
  genres?: Array<{
    id: number;
    name: string;
  }>;
};

export type TmdbMovieCredits = {
  id: number;
  cast?: Array<{
    id: number;
    name: string;
    character?: string | null;
    profile_path?: string | null;
    order?: number | null;
  }>;
};

type SearchTmdbMoviesOptions = {
  query: string;
  page?: number;
  language?: string | null;
};

export type TmdbAuth = {
  apiToken: string;
};

function tmdbUrl(path: string, params: Record<string, string | number | boolean | null | undefined> = {}) {
  const url = new URL(`${tmdbBaseUrl}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

export async function loadTmdbAuthForUser(userId: string): Promise<TmdbAuth> {
  const apiToken = await readProviderSecret(userId, "tmdb", "api_token_encrypted");

  if (!apiToken) {
    throw new AppError("Add your TMDB API Read Access Token in settings before using TMDB.", {
      code: "TMDB_TOKEN_MISSING",
      status: 409,
    });
  }

  return { apiToken };
}

async function fetchTmdbJson<T>(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  const user = await requireUser();
  const auth = await loadTmdbAuthForUser(user.id);

  return fetchTmdbJsonWithAuth<T>(auth, path, params);
}

function fetchTmdbJsonWithAuth<T>(
  auth: TmdbAuth,
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  return fetchJson<T>(tmdbUrl(path, params), {
    headers: {
      authorization: `Bearer ${auth.apiToken}`,
    },
  });
}

export function searchTmdbMovies({
  query,
  page = 1,
  language,
}: SearchTmdbMoviesOptions) {
  return fetchTmdbJson<TmdbMovieSearchResponse>("/search/movie", {
    query,
    page,
    language,
    include_adult: false,
  });
}

export function getTmdbMovieDetails(tmdbId: number, language?: string | null) {
  return fetchTmdbJson<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    language,
  });
}

export function getTmdbMovieDetailsWithAuth(
  auth: TmdbAuth,
  tmdbId: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbMovieDetails>(auth, `/movie/${tmdbId}`, {
    language,
  });
}

export function getTmdbMovieCredits(tmdbId: number, language?: string | null) {
  return fetchTmdbJson<TmdbMovieCredits>(`/movie/${tmdbId}/credits`, {
    language,
  });
}

export function getTmdbMovieCreditsWithAuth(
  auth: TmdbAuth,
  tmdbId: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbMovieCredits>(auth, `/movie/${tmdbId}/credits`, {
    language,
  });
}
