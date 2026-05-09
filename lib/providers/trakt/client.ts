import "server-only";

import { parseJsonResponse } from "@/lib/fetch";

const traktBaseUrl = "https://api.trakt.tv";
const traktWebBaseUrl = "https://trakt.tv";
const traktApiVersion = "2";

export type TraktMovieIds = {
  trakt?: number | null;
  slug?: string | null;
  imdb?: string | null;
  tmdb?: number | null;
};

export type TraktMovie = {
  title?: string;
  year?: number | null;
  ids: TraktMovieIds;
};

export type TraktHistoryMovie = {
  id: number;
  watched_at: string;
  action?: string;
  type?: "movie";
  movie: TraktMovie;
};

export type TraktWatchlistMovie = {
  rank?: number;
  listed_at: string;
  type?: "movie";
  movie: TraktMovie;
};

export type TraktRatedMovie = {
  rated_at: string;
  rating: number;
  type?: "movie";
  movie: TraktMovie;
};

export type TraktSyncMovie = TraktMovie & {
  watched_at?: string;
  listed_at?: string;
  rated_at?: string;
  rating?: number;
};

export type TraktSyncRequest = {
  movies: TraktSyncMovie[];
};

export type TraktSyncResponse = {
  added?: Record<string, number>;
  deleted?: Record<string, number>;
  existing?: Record<string, number>;
  not_found?: {
    movies?: TraktSyncMovie[];
  };
};

export type TraktAuth = {
  accessToken: string;
  clientId: string;
};

export type TraktOAuthTokenResponse = {
  access_token: string;
  created_at?: number;
  expires_in: number;
  refresh_token: string;
  scope?: string;
  token_type: string;
};

export type TraktRequestOptions = {
  body?: unknown;
  clientId: string;
  method?: "GET" | "POST" | "DELETE" | "PUT";
  query?: Record<string, string | number | boolean | null | undefined>;
  accessToken?: string;
};

function traktUrl(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
) {
  const url = new URL(`${traktBaseUrl}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

function withTraktHeaders(clientId: string, accessToken?: string) {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
    "trakt-api-key": clientId,
    "trakt-api-version": traktApiVersion,
  });

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

export async function fetchTraktJson<T>(
  path: string,
  options: TraktRequestOptions,
): Promise<T> {
  const response = await fetch(traktUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: withTraktHeaders(options.clientId, options.accessToken),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  return parseJsonResponse<T>(response);
}

export function getTraktAuthorizeUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("/oauth/authorize", traktWebBaseUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeTraktCode({
  clientId,
  clientSecret,
  code,
  redirectUri,
}: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}) {
  const response = await fetch(`${traktBaseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  return parseJsonResponse<TraktOAuthTokenResponse>(response);
}

export async function refreshTraktToken({
  clientId,
  clientSecret,
  refreshToken,
  redirectUri,
}: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri: string;
}) {
  const response = await fetch(`${traktBaseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "refresh_token",
    }),
  });

  return parseJsonResponse<TraktOAuthTokenResponse>(response);
}

export function getTraktUserSettings(auth: TraktAuth) {
  return fetchTraktJson<{ user?: { username?: string; ids?: { slug?: string } } }>(
    "/users/settings",
    { accessToken: auth.accessToken, clientId: auth.clientId },
  );
}

export function listTraktHistoryMovies(
  auth: TraktAuth,
  options: { page: number; limit: number; startAt?: string | null },
) {
  return fetchTraktJson<TraktHistoryMovie[]>("/users/me/history/movies", {
    accessToken: auth.accessToken,
    clientId: auth.clientId,
    query: {
      page: options.page,
      limit: options.limit,
      start_at: options.startAt,
    },
  });
}

export function listTraktWatchlistMovies(
  auth: TraktAuth,
  options: { page: number; limit: number },
) {
  return fetchTraktJson<TraktWatchlistMovie[]>("/users/me/watchlist/movies/added", {
    accessToken: auth.accessToken,
    clientId: auth.clientId,
    query: {
      page: options.page,
      limit: options.limit,
    },
  });
}

export function listTraktRatedMovies(auth: TraktAuth) {
  return fetchTraktJson<TraktRatedMovie[]>("/users/me/ratings/movies", {
    accessToken: auth.accessToken,
    clientId: auth.clientId,
  });
}

export function addTraktHistory(auth: TraktAuth, body: TraktSyncRequest) {
  return fetchTraktJson<TraktSyncResponse>("/sync/history", {
    accessToken: auth.accessToken,
    body,
    clientId: auth.clientId,
    method: "POST",
  });
}

export function removeTraktHistory(auth: TraktAuth, body: TraktSyncRequest) {
  return fetchTraktJson<TraktSyncResponse>("/sync/history/remove", {
    accessToken: auth.accessToken,
    body,
    clientId: auth.clientId,
    method: "POST",
  });
}

export function addTraktWatchlist(auth: TraktAuth, body: TraktSyncRequest) {
  return fetchTraktJson<TraktSyncResponse>("/sync/watchlist", {
    accessToken: auth.accessToken,
    body,
    clientId: auth.clientId,
    method: "POST",
  });
}

export function removeTraktWatchlist(auth: TraktAuth, body: TraktSyncRequest) {
  return fetchTraktJson<TraktSyncResponse>("/sync/watchlist/remove", {
    accessToken: auth.accessToken,
    body,
    clientId: auth.clientId,
    method: "POST",
  });
}

export function setTraktRatings(auth: TraktAuth, body: TraktSyncRequest) {
  return fetchTraktJson<TraktSyncResponse>("/sync/ratings", {
    accessToken: auth.accessToken,
    body,
    clientId: auth.clientId,
    method: "POST",
  });
}

export function removeTraktRatings(auth: TraktAuth, body: TraktSyncRequest) {
  return fetchTraktJson<TraktSyncResponse>("/sync/ratings/remove", {
    accessToken: auth.accessToken,
    body,
    clientId: auth.clientId,
    method: "POST",
  });
}
