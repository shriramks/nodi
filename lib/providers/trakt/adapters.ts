import "server-only";

import type { Movie, ProviderMapping } from "@/lib/db/types";
import type {
  TraktMovie,
  TraktMovieIds,
  TraktRatedMovie,
  TraktSyncMovie,
  TraktWatchlistMovie,
} from "@/lib/providers/trakt/client";

export type LocalMovieForTrakt = Pick<
  Movie,
  "id" | "imdb_id" | "release_year" | "title" | "tmdb_id"
>;

export type RemoteTraktMovieState = {
  imdbId: string | null;
  key: string;
  title: string | null;
  tmdbId: number | null;
  traktId: string | null;
  year: number | null;
};

export type RemoteTraktWatchlistState = RemoteTraktMovieState & {
  listedAt: string;
};

export type RemoteTraktRatingState = RemoteTraktMovieState & {
  ratedAt: string;
  rating: number;
};

export function toTraktMovieIds(
  movie: LocalMovieForTrakt,
  mappings: ProviderMapping[] = [],
): TraktMovieIds {
  const ids: TraktMovieIds = {
    tmdb: movie.tmdb_id,
  };

  if (movie.imdb_id) {
    ids.imdb = movie.imdb_id;
  }

  mappings.forEach((mapping) => {
    if (mapping.provider === "trakt") {
      const traktId = Number(mapping.provider_movie_id);

      if (Number.isInteger(traktId) && traktId > 0) {
        ids.trakt = traktId;
      }
    } else if (mapping.provider === "imdb" && mapping.provider_movie_id) {
      ids.imdb = mapping.provider_movie_id;
    } else if (mapping.provider === "tmdb") {
      const tmdbId = Number(mapping.provider_movie_id);

      if (Number.isInteger(tmdbId) && tmdbId > 0) {
        ids.tmdb = tmdbId;
      }
    }
  });

  return ids;
}

export function toTraktSyncMovie(
  movie: LocalMovieForTrakt,
  mappings: ProviderMapping[] = [],
): TraktSyncMovie {
  return {
    title: movie.title,
    year: movie.release_year,
    ids: toTraktMovieIds(movie, mappings),
  };
}

export function toTraktHistoryMovie(
  movie: LocalMovieForTrakt,
  watchedAt: string,
  mappings: ProviderMapping[] = [],
): TraktSyncMovie {
  return {
    ...toTraktSyncMovie(movie, mappings),
    watched_at: watchedAt,
  };
}

export function toTraktRatedMovie(
  movie: LocalMovieForTrakt,
  rating: number,
  ratedAt: string,
  mappings: ProviderMapping[] = [],
): TraktSyncMovie {
  return {
    ...toTraktSyncMovie(movie, mappings),
    rated_at: ratedAt,
    rating,
  };
}

export function getTraktMovieKey(movie: TraktMovie) {
  const traktId = normalizeTraktId(movie.ids.trakt);
  const tmdbId = normalizeNumberId(movie.ids.tmdb);
  const imdbId = normalizeImdbId(movie.ids.imdb);

  if (traktId) {
    return `trakt:${traktId}`;
  }

  if (tmdbId) {
    return `tmdb:${tmdbId}`;
  }

  if (imdbId) {
    return `imdb:${imdbId}`;
  }

  return null;
}

export function toRemoteTraktMovieState(movie: TraktMovie): RemoteTraktMovieState | null {
  const key = getTraktMovieKey(movie);

  if (!key) {
    return null;
  }

  return {
    imdbId: normalizeImdbId(movie.ids.imdb),
    key,
    title: typeof movie.title === "string" ? movie.title : null,
    tmdbId: normalizeNumberId(movie.ids.tmdb),
    traktId: normalizeTraktId(movie.ids.trakt),
    year: normalizeNumberId(movie.year),
  };
}

export function toRemoteTraktWatchlistState(
  item: TraktWatchlistMovie,
): RemoteTraktWatchlistState | null {
  const movie = toRemoteTraktMovieState(item.movie);

  if (!movie) {
    return null;
  }

  return {
    ...movie,
    listedAt: item.listed_at,
  };
}

export function toRemoteTraktRatingState(
  item: TraktRatedMovie,
): RemoteTraktRatingState | null {
  const movie = toRemoteTraktMovieState(item.movie);

  if (!movie || !Number.isInteger(item.rating)) {
    return null;
  }

  return {
    ...movie,
    ratedAt: item.rated_at,
    rating: Math.min(Math.max(item.rating, 1), 10),
  };
}

export function normalizeTraktId(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const traktId = Number(value);

  return Number.isInteger(traktId) && traktId > 0 ? String(traktId) : null;
}

function normalizeNumberId(value: number | null | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : null;
}

function normalizeImdbId(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized ? normalized : null;
}
