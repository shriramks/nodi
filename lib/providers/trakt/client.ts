import "server-only";

import { parseJsonResponse } from "@/lib/fetch";

const traktBaseUrl = "https://api.trakt.tv";
const traktWebBaseUrl = "https://trakt.tv";
const traktApiVersion = "2";
const traktUserAgent = "Nodi/0.1 (+https://movienodi.vercel.app)";

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

export type TraktUserList = {
  name: string;
  ids: {
    trakt?: number | null;
    slug?: string | null;
  };
  item_count?: number | null;
  updated_at?: string | null;
};

export type TraktListMovie = {
  rank?: number;
  listed_at?: string;
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

export type TraktPagination = {
  itemCount: number | null;
  limit: number | null;
  page: number | null;
  pageCount: number | null;
};

export type TraktPaginatedResponse<T> = {
  items: T;
  pagination: TraktPagination;
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
    "user-agent": traktUserAgent,
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

export async function fetchTraktJsonPage<T>(
  path: string,
  options: TraktRequestOptions,
): Promise<TraktPaginatedResponse<T>> {
  const response = await fetch(traktUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: withTraktHeaders(options.clientId, options.accessToken),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const items = await parseJsonResponse<T>(response);

  return {
    items,
    pagination: parseTraktPagination(response.headers),
  };
}

function parseTraktPagination(headers: Headers): TraktPagination {
  return {
    itemCount: readPositiveHeader(headers, "x-pagination-item-count"),
    limit: readPositiveHeader(headers, "x-pagination-limit"),
    page: readPositiveHeader(headers, "x-pagination-page"),
    pageCount: readPositiveHeader(headers, "x-pagination-page-count"),
  };
}

function readPositiveHeader(headers: Headers, name: string) {
  const rawValue = headers.get(name);

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : null;
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
      "trakt-api-key": clientId,
      "trakt-api-version": traktApiVersion,
      "user-agent": traktUserAgent,
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
      "trakt-api-key": clientId,
      "trakt-api-version": traktApiVersion,
      "user-agent": traktUserAgent,
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

export function listTraktHistoryMoviesPage(
  auth: TraktAuth,
  options: { page: number; limit: number; startAt?: string | null },
) {
  return fetchTraktJsonPage<TraktHistoryMovie[]>("/users/me/history/movies", {
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

export function listTraktWatchlistMoviesPage(
  auth: TraktAuth,
  options: { page: number; limit: number },
) {
  return fetchTraktJsonPage<TraktWatchlistMovie[]>("/users/me/watchlist/movies/added", {
    accessToken: auth.accessToken,
    clientId: auth.clientId,
    query: {
      page: options.page,
      limit: options.limit,
    },
  });
}

export function listTraktRatedMovies(
  auth: TraktAuth,
  options?: { page?: number; limit?: number },
) {
  return fetchTraktJson<TraktRatedMovie[]>("/users/me/ratings/movies", {
    accessToken: auth.accessToken,
    clientId: auth.clientId,
    query: {
      page: options?.page,
      limit: options?.limit,
    },
  });
}

export function listTraktRatedMoviesPage(
  auth: TraktAuth,
  options: { page: number; limit: number },
) {
  return fetchTraktJsonPage<TraktRatedMovie[]>("/users/me/ratings/movies", {
    accessToken: auth.accessToken,
    clientId: auth.clientId,
    query: {
      page: options.page,
      limit: options.limit,
    },
  });
}

export function listTraktUserListsPage(
  auth: TraktAuth,
  options: { page: number; limit: number },
) {
  return fetchTraktJsonPage<TraktUserList[]>("/users/me/lists", {
    accessToken: auth.accessToken,
    clientId: auth.clientId,
    query: {
      page: options.page,
      limit: options.limit,
    },
  });
}

export function listTraktListMovieItemsPage(
  auth: TraktAuth,
  options: { listId: number | string; page: number; limit: number },
) {
  return fetchTraktJsonPage<TraktListMovie[]>(
    `/users/me/lists/${encodeURIComponent(String(options.listId))}/items/movies`,
    {
      accessToken: auth.accessToken,
      clientId: auth.clientId,
      query: {
        page: options.page,
        limit: options.limit,
      },
    },
  );
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
