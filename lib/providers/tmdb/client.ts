import "server-only";

import { cache } from "react";

import { requireUser } from "@/lib/auth/server";
import { fetchJson } from "@/lib/fetch";
import { AppError } from "@/lib/errors";
import { readProviderSecret } from "@/lib/providers/credentials";

const tmdbBaseUrl = "https://api.themoviedb.org/3";

export type TmdbMovieSearchResult = {
  adult?: boolean;
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

export type TmdbMovieListResponse = TmdbMovieSearchResponse;

export type TmdbTvSearchResult = {
  adult?: boolean;
  backdrop_path?: string | null;
  first_air_date?: string;
  genre_ids?: number[];
  id: number;
  name: string;
  origin_country?: string[];
  original_language?: string;
  original_name: string;
  overview?: string;
  popularity?: number;
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
};

export type TmdbTvSearchResponse = {
  page: number;
  results: TmdbTvSearchResult[];
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
  belongs_to_collection?: {
    id: number;
    name?: string | null;
    poster_path?: string | null;
    backdrop_path?: string | null;
  } | null;
  genres?: Array<{
    id: number;
    name: string;
  }>;
};

export type TmdbTvNetwork = {
  id: number;
  name: string;
  logo_path?: string | null;
  origin_country?: string | null;
};

export type TmdbTvProductionCompany = {
  id: number;
  name: string;
  logo_path?: string | null;
  origin_country?: string | null;
};

export type TmdbTvSeasonSummary = {
  air_date?: string | null;
  episode_count?: number | null;
  id: number;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  season_number: number;
  vote_average?: number | null;
};

export type TmdbTvDetails = {
  adult?: boolean;
  backdrop_path?: string | null;
  episode_run_time?: number[];
  first_air_date?: string | null;
  genres?: Array<{
    id: number;
    name: string;
  }>;
  homepage?: string | null;
  id: number;
  in_production?: boolean;
  languages?: string[];
  last_air_date?: string | null;
  name: string;
  networks?: TmdbTvNetwork[];
  number_of_episodes?: number | null;
  number_of_seasons?: number | null;
  origin_country?: string[];
  original_language?: string | null;
  original_name?: string | null;
  overview?: string | null;
  popularity?: number | null;
  poster_path?: string | null;
  production_companies?: TmdbTvProductionCompany[];
  seasons?: TmdbTvSeasonSummary[];
  status?: string | null;
  tagline?: string | null;
  type?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
};

export type TmdbTvEpisodeDetails = {
  air_date?: string | null;
  crew?: Array<{
    id: number;
    name: string;
    job?: string | null;
    department?: string | null;
    profile_path?: string | null;
  }>;
  episode_number: number;
  episode_type?: string | null;
  guest_stars?: Array<{
    id: number;
    name: string;
    character?: string | null;
    profile_path?: string | null;
    order?: number | null;
  }>;
  id: number;
  name?: string | null;
  overview?: string | null;
  production_code?: string | null;
  runtime?: number | null;
  season_number: number;
  show_id?: number;
  still_path?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
};

export type TmdbTvSeasonDetails = {
  _id?: string;
  air_date?: string | null;
  episodes?: TmdbTvEpisodeDetails[];
  id: number;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  season_number: number;
  vote_average?: number | null;
};

export type TmdbTvAggregateCredits = {
  cast?: Array<{
    id: number;
    name: string;
    order?: number | null;
    profile_path?: string | null;
    roles?: Array<{
      character?: string | null;
      episode_count?: number | null;
    }>;
    total_episode_count?: number | null;
  }>;
  crew?: unknown[];
  id: number;
};

export type TmdbMovieAppendToResponse =
  | "credits"
  | "keywords"
  | "recommendations"
  | "similar";

export type TmdbMovieCredits = {
  id: number;
  cast?: Array<{
    id: number;
    name: string;
    character?: string | null;
    profile_path?: string | null;
    order?: number | null;
  }>;
  crew?: Array<{
    id: number;
    name: string;
    job?: string | null;
    department?: string | null;
    profile_path?: string | null;
  }>;
};

export type TmdbMovieKeyword = {
  id: number;
  name: string;
};

export type TmdbMovieKeywordsResponse = {
  id: number;
  keywords?: TmdbMovieKeyword[];
};

export type TmdbMovieDetailsWithAppendedResponses = TmdbMovieDetails & {
  credits?: TmdbMovieCredits;
  keywords?: TmdbMovieKeywordsResponse;
  recommendations?: TmdbMovieListResponse;
  similar?: TmdbMovieListResponse;
};

export type TmdbCollectionDetails = {
  id: number;
  name?: string | null;
  parts?: TmdbMovieSearchResult[];
};

export type TmdbPersonDetails = {
  adult?: boolean;
  also_known_as?: string[];
  biography?: string | null;
  birthday?: string | null;
  deathday?: string | null;
  gender?: number | null;
  homepage?: string | null;
  id: number;
  imdb_id?: string | null;
  known_for_department?: string | null;
  name: string;
  place_of_birth?: string | null;
  popularity?: number | null;
  profile_path?: string | null;
};

export type TmdbPersonCredit = {
  adult?: boolean;
  backdrop_path?: string | null;
  character?: string | null;
  credit_id?: string;
  department?: string | null;
  episode_count?: number;
  first_air_date?: string | null;
  id: number;
  job?: string | null;
  media_type?: "movie" | "tv" | string;
  name?: string | null;
  order?: number;
  original_name?: string | null;
  original_title?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  release_date?: string | null;
  title?: string | null;
  video?: boolean;
  vote_average?: number | null;
  vote_count?: number | null;
  popularity?: number | null;
};

export type TmdbPersonCombinedCredits = {
  id: number;
  cast?: TmdbPersonCredit[];
  crew?: TmdbPersonCredit[];
};

export type TmdbPersonDetailsWithCombinedCredits = TmdbPersonDetails & {
  combined_credits?: TmdbPersonCombinedCredits;
};

type SearchTmdbMoviesOptions = {
  query: string;
  page?: number;
  language?: string | null;
};

type SearchTmdbTvOptions = SearchTmdbMoviesOptions;

type DiscoverTmdbMoviesOptions = {
  language?: string | null;
  page?: number;
  primaryReleaseDateGte?: string | null;
  primaryReleaseDateLte?: string | null;
  sortBy?: string | null;
  voteCountGte?: number | null;
  withCast?: string | null;
  withCrew?: string | null;
  withGenres?: string | null;
  withKeywords?: string | null;
  withOriginalLanguage?: string | null;
  withPeople?: string | null;
};

export type TmdbAuth = {
  apiToken: string;
};

type TmdbRemoteDetailTimingContext = {
  id: number;
  resource: "movie" | "person";
  route: string;
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

export const loadTmdbAuthForUser = cache(async (userId: string): Promise<TmdbAuth> => {
  const apiToken = await readProviderSecret(userId, "tmdb", "api_token_encrypted");

  if (!apiToken) {
    throw new AppError("Add your TMDB API Read Access Token in settings before using TMDB.", {
      code: "TMDB_TOKEN_MISSING",
      status: 409,
    });
  }

  return { apiToken };
});

export const loadTmdbAuthForCurrentUser = cache(async (): Promise<TmdbAuth> => {
  const user = await requireUser();
  return loadTmdbAuthForUser(user.id);
});

async function fetchTmdbJson<T>(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  const auth = await loadTmdbAuthForCurrentUser();
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

export function searchTmdbTv({
  query,
  page = 1,
  language,
}: SearchTmdbTvOptions) {
  return fetchTmdbJson<TmdbTvSearchResponse>("/search/tv", {
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

export function getTmdbTvDetails(tmdbId: number, language?: string | null) {
  return fetchTmdbJson<TmdbTvDetails>(`/tv/${tmdbId}`, {
    language,
  });
}

export function getTmdbTvDetailsWithAuth(
  auth: TmdbAuth,
  tmdbId: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbTvDetails>(auth, `/tv/${tmdbId}`, {
    language,
  });
}

export function getTmdbTvAggregateCredits(tmdbId: number, language?: string | null) {
  return fetchTmdbJson<TmdbTvAggregateCredits>(`/tv/${tmdbId}/aggregate_credits`, {
    language,
  });
}

export function getTmdbTvAggregateCreditsWithAuth(
  auth: TmdbAuth,
  tmdbId: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbTvAggregateCredits>(
    auth,
    `/tv/${tmdbId}/aggregate_credits`,
    {
      language,
    },
  );
}

export function getTmdbTvSeasonDetails(
  tmdbId: number,
  seasonNumber: number,
  language?: string | null,
) {
  return fetchTmdbJson<TmdbTvSeasonDetails>(`/tv/${tmdbId}/season/${seasonNumber}`, {
    language,
  });
}

export function getTmdbTvSeasonDetailsWithAuth(
  auth: TmdbAuth,
  tmdbId: number,
  seasonNumber: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbTvSeasonDetails>(
    auth,
    `/tv/${tmdbId}/season/${seasonNumber}`,
    {
      language,
    },
  );
}

export function getTmdbTvEpisodeDetails(
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
  language?: string | null,
) {
  return fetchTmdbJson<TmdbTvEpisodeDetails>(
    `/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`,
    {
      language,
    },
  );
}

export function getTmdbTvEpisodeDetailsWithAuth(
  auth: TmdbAuth,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbTvEpisodeDetails>(
    auth,
    `/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`,
    {
      language,
    },
  );
}

export function getTmdbMovieDetailsWithAppendedResponses(
  tmdbId: number,
  appendToResponse: TmdbMovieAppendToResponse[],
  language?: string | null,
) {
  return getCachedTmdbMovieDetailsWithAppendedResponses(
    tmdbId,
    appendToResponse.join(","),
    language ?? null,
  );
}

const getCachedTmdbMovieDetailsWithAppendedResponses = cache(
  (
    tmdbId: number,
    appendToResponse: string,
    language: string | null,
  ) => fetchTmdbJson<TmdbMovieDetailsWithAppendedResponses>(`/movie/${tmdbId}`, {
    append_to_response: appendToResponse,
    language,
  }),
);

export function getTmdbMovieDetailsWithAppendedResponsesWithAuth(
  auth: TmdbAuth,
  tmdbId: number,
  appendToResponse: TmdbMovieAppendToResponse[],
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbMovieDetailsWithAppendedResponses>(auth, `/movie/${tmdbId}`, {
    append_to_response: appendToResponse.join(","),
    language,
  });
}

export function getTmdbMovieCredits(tmdbId: number, language?: string | null) {
  return fetchTmdbJson<TmdbMovieCredits>(`/movie/${tmdbId}/credits`, {
    language,
  });
}

export function getTmdbMovieKeywords(tmdbId: number) {
  return fetchTmdbJson<TmdbMovieKeywordsResponse>(`/movie/${tmdbId}/keywords`);
}

export function getTmdbMovieKeywordsWithAuth(auth: TmdbAuth, tmdbId: number) {
  return fetchTmdbJsonWithAuth<TmdbMovieKeywordsResponse>(auth, `/movie/${tmdbId}/keywords`);
}

export function getTmdbCollectionDetails(collectionId: number, language?: string | null) {
  return fetchTmdbJson<TmdbCollectionDetails>(`/collection/${collectionId}`, {
    language,
  });
}

export function getTmdbCollectionDetailsWithAuth(
  auth: TmdbAuth,
  collectionId: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbCollectionDetails>(auth, `/collection/${collectionId}`, {
    language,
  });
}

export function discoverTmdbMovies({
  language,
  page = 1,
  primaryReleaseDateGte,
  primaryReleaseDateLte,
  sortBy = "popularity.desc",
  voteCountGte,
  withCast,
  withCrew,
  withGenres,
  withKeywords,
  withOriginalLanguage,
  withPeople,
}: DiscoverTmdbMoviesOptions) {
  return fetchTmdbJson<TmdbMovieListResponse>("/discover/movie", {
    include_adult: false,
    include_video: false,
    language,
    page,
    "primary_release_date.gte": primaryReleaseDateGte,
    "primary_release_date.lte": primaryReleaseDateLte,
    sort_by: sortBy,
    "vote_count.gte": voteCountGte,
    with_cast: withCast,
    with_crew: withCrew,
    with_genres: withGenres,
    with_keywords: withKeywords,
    with_original_language: withOriginalLanguage,
    with_people: withPeople,
  });
}

export function discoverTmdbMoviesWithAuth(
  auth: TmdbAuth,
  {
    language,
    page = 1,
    primaryReleaseDateGte,
    primaryReleaseDateLte,
    sortBy = "popularity.desc",
    voteCountGte,
    withCast,
    withCrew,
    withGenres,
    withKeywords,
    withOriginalLanguage,
    withPeople,
  }: DiscoverTmdbMoviesOptions,
) {
  return fetchTmdbJsonWithAuth<TmdbMovieListResponse>(auth, "/discover/movie", {
    include_adult: false,
    include_video: false,
    language,
    page,
    "primary_release_date.gte": primaryReleaseDateGte,
    "primary_release_date.lte": primaryReleaseDateLte,
    sort_by: sortBy,
    "vote_count.gte": voteCountGte,
    with_cast: withCast,
    with_crew: withCrew,
    with_genres: withGenres,
    with_keywords: withKeywords,
    with_original_language: withOriginalLanguage,
    with_people: withPeople,
  });
}

export function getTmdbMovieRecommendations(
  tmdbId: number,
  language?: string | null,
  page = 1,
) {
  return fetchTmdbJson<TmdbMovieListResponse>(`/movie/${tmdbId}/recommendations`, {
    language,
    page,
  });
}

export function getTmdbMovieRecommendationsWithAuth(
  auth: TmdbAuth,
  tmdbId: number,
  language?: string | null,
  page = 1,
) {
  return fetchTmdbJsonWithAuth<TmdbMovieListResponse>(auth, `/movie/${tmdbId}/recommendations`, {
    language,
    page,
  });
}

export function getTmdbSimilarMovies(
  tmdbId: number,
  language?: string | null,
  page = 1,
) {
  return fetchTmdbJson<TmdbMovieListResponse>(`/movie/${tmdbId}/similar`, {
    language,
    page,
  });
}

export function getTmdbSimilarMoviesWithAuth(
  auth: TmdbAuth,
  tmdbId: number,
  language?: string | null,
  page = 1,
) {
  return fetchTmdbJsonWithAuth<TmdbMovieListResponse>(auth, `/movie/${tmdbId}/similar`, {
    language,
    page,
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

export function getTmdbPersonDetails(personId: number, language?: string | null) {
  return fetchTmdbJson<TmdbPersonDetails>(`/person/${personId}`, {
    language,
  });
}

export function getTmdbPersonDetailsWithAuth(
  auth: TmdbAuth,
  personId: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbPersonDetails>(auth, `/person/${personId}`, {
    language,
  });
}

export function getTmdbPersonDetailsWithCombinedCredits(
  personId: number,
  language?: string | null,
) {
  return getCachedTmdbPersonDetailsWithCombinedCredits(personId, language ?? null);
}

const getCachedTmdbPersonDetailsWithCombinedCredits = cache(
  (personId: number, language: string | null) =>
    fetchTmdbJson<TmdbPersonDetailsWithCombinedCredits>(`/person/${personId}`, {
      append_to_response: "combined_credits",
      language,
    }),
);

export function getTmdbPersonDetailsWithCombinedCreditsWithAuth(
  auth: TmdbAuth,
  personId: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbPersonDetailsWithCombinedCredits>(auth, `/person/${personId}`, {
    append_to_response: "combined_credits",
    language,
  });
}

export function getTmdbPersonCombinedCredits(
  personId: number,
  language?: string | null,
) {
  return fetchTmdbJson<TmdbPersonCombinedCredits>(
    `/person/${personId}/combined_credits`,
    {
      language,
    },
  );
}

export function getTmdbPersonCombinedCreditsWithAuth(
  auth: TmdbAuth,
  personId: number,
  language?: string | null,
) {
  return fetchTmdbJsonWithAuth<TmdbPersonCombinedCredits>(
    auth,
    `/person/${personId}/combined_credits`,
    {
      language,
    },
  );
}

export async function timeTmdbRemoteDetailLoad<T>(
  context: TmdbRemoteDetailTimingContext,
  load: () => Promise<T>,
) {
  const startedAt = Date.now();
  let outcome = "ok";

  try {
    return await load();
  } catch (error) {
    outcome = "error";
    throw error;
  } finally {
    console.info("tmdb.remote_detail.load", {
      durationMs: Date.now() - startedAt,
      id: context.id,
      outcome,
      resource: context.resource,
      route: context.route,
    });
  }
}
