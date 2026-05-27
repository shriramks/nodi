import "server-only";

import type { Episode, MediaItem, MediaProviderMapping, Movie, ProviderMapping } from "@/lib/db/types";
import type {
  TraktEpisode,
  TraktEpisodeIds,
  TraktHistoryEpisode,
  TraktMovie,
  TraktMovieIds,
  TraktRatedMovie,
  TraktRatedShow,
  TraktShow,
  TraktShowIds,
  TraktSyncEpisode,
  TraktSyncMovie,
  TraktSyncShow,
  TraktWatchlistMovie,
  TraktWatchlistShow,
} from "@/lib/providers/trakt/client";

export type LocalMovieForTrakt = Pick<
  Movie,
  "id" | "imdb_id" | "release_year" | "title" | "tmdb_id"
>;

export type LocalShowForTrakt = Pick<
  MediaItem,
  "first_air_date" | "id" | "release_year" | "title"
>;

export type LocalEpisodeForTrakt = Pick<
  Episode,
  "episode_number" | "id" | "season_number" | "title"
>;

export type RemoteTraktMovieState = {
  imdbId: string | null;
  key: string;
  title: string | null;
  tmdbId: number | null;
  traktId: string | null;
  year: number | null;
};

export type RemoteTraktShowState = {
  imdbId: string | null;
  key: string;
  title: string | null;
  tmdbId: number | null;
  traktId: string | null;
  year: number | null;
};

export type RemoteTraktEpisodeState = {
  episodeNumber: number;
  imdbId: string | null;
  key: string;
  seasonNumber: number;
  title: string | null;
  tmdbId: number | null;
  traktId: string | null;
};

export type RemoteTraktWatchlistState = RemoteTraktMovieState & {
  listedAt: string;
};

export type RemoteTraktShowWatchlistState = RemoteTraktShowState & {
  listedAt: string;
};

export type RemoteTraktRatingState = RemoteTraktMovieState & {
  ratedAt: string;
  rating: number;
};

export type RemoteTraktShowRatingState = RemoteTraktShowState & {
  ratedAt: string;
  rating: number;
};

export type RemoteTraktEpisodeHistoryState = {
  episode: RemoteTraktEpisodeState;
  item: TraktHistoryEpisode;
  show: RemoteTraktShowState;
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

export function toTraktShowIds(
  show: LocalShowForTrakt,
  mappings: MediaProviderMapping[] = [],
): TraktShowIds {
  const ids: TraktShowIds = {};

  mappings.forEach((mapping) => {
    if (mapping.provider === "trakt") {
      const traktId = Number(mapping.provider_id);

      if (Number.isInteger(traktId) && traktId > 0) {
        ids.trakt = traktId;
      }
    } else if (mapping.provider === "imdb" && mapping.provider_id) {
      ids.imdb = mapping.provider_id;
    } else if (mapping.provider === "tmdb") {
      const tmdbId = Number(mapping.provider_id);

      if (Number.isInteger(tmdbId) && tmdbId > 0) {
        ids.tmdb = tmdbId;
      }
    }
  });

  return ids;
}

export function toTraktEpisodeIds(
  mappings: MediaProviderMapping[] = [],
): TraktEpisodeIds {
  const ids: TraktEpisodeIds = {};

  mappings.forEach((mapping) => {
    if (mapping.provider === "trakt") {
      const traktId = Number(mapping.provider_id);

      if (Number.isInteger(traktId) && traktId > 0) {
        ids.trakt = traktId;
      }
    } else if (mapping.provider === "imdb" && mapping.provider_id) {
      ids.imdb = mapping.provider_id;
    } else if (mapping.provider === "tmdb") {
      const tmdbId = Number(mapping.provider_id);

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

export function toTraktSyncShow(
  show: LocalShowForTrakt,
  mappings: MediaProviderMapping[] = [],
): TraktSyncShow {
  return {
    title: show.title,
    year: show.release_year ?? releaseYear(show.first_air_date),
    ids: toTraktShowIds(show, mappings),
  };
}

export function toTraktRatedShow(
  show: LocalShowForTrakt,
  rating: number,
  ratedAt: string,
  mappings: MediaProviderMapping[] = [],
): TraktSyncShow {
  return {
    ...toTraktSyncShow(show, mappings),
    rated_at: ratedAt,
    rating,
  };
}

export function toTraktHistoryEpisode(
  episode: LocalEpisodeForTrakt,
  watchedAt: string,
  mappings: MediaProviderMapping[] = [],
): TraktSyncEpisode {
  return {
    ids: toTraktEpisodeIds(mappings),
    number: episode.episode_number,
    season: episode.season_number,
    title: episode.title,
    watched_at: watchedAt,
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

export function getTraktShowKey(show: TraktShow) {
  const traktId = normalizeTraktId(show.ids.trakt);
  const tmdbId = normalizeNumberId(show.ids.tmdb);
  const imdbId = normalizeImdbId(show.ids.imdb);

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

export function getTraktEpisodeKey(show: RemoteTraktShowState, episode: TraktEpisode) {
  const traktId = normalizeTraktId(episode.ids?.trakt);
  const tmdbId = normalizeNumberId(episode.ids?.tmdb);
  const imdbId = normalizeImdbId(episode.ids?.imdb);
  const seasonNumber = normalizeNumberId(episode.season);
  const episodeNumber = normalizeNumberId(episode.number);

  if (traktId) {
    return `trakt:${traktId}`;
  }

  if (tmdbId) {
    return `tmdb:${tmdbId}`;
  }

  if (imdbId) {
    return `imdb:${imdbId}`;
  }

  if (seasonNumber !== null && episodeNumber !== null) {
    return `show:${show.key}:s${seasonNumber}:e${episodeNumber}`;
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

export function toRemoteTraktShowState(show: TraktShow): RemoteTraktShowState | null {
  const key = getTraktShowKey(show);

  if (!key) {
    return null;
  }

  return {
    imdbId: normalizeImdbId(show.ids.imdb),
    key,
    title: typeof show.title === "string" ? show.title : null,
    tmdbId: normalizeNumberId(show.ids.tmdb),
    traktId: normalizeTraktId(show.ids.trakt),
    year: normalizeNumberId(show.year),
  };
}

export function toRemoteTraktEpisodeHistoryState(
  item: TraktHistoryEpisode,
): RemoteTraktEpisodeHistoryState | null {
  const show = toRemoteTraktShowState(item.show);

  if (!show) {
    return null;
  }

  const key = getTraktEpisodeKey(show, item.episode);
  const seasonNumber = normalizeNumberId(item.episode.season);
  const episodeNumber = normalizeNumberId(item.episode.number);

  if (!key || seasonNumber === null || episodeNumber === null) {
    return null;
  }

  return {
    episode: {
      episodeNumber,
      imdbId: normalizeImdbId(item.episode.ids?.imdb),
      key,
      seasonNumber,
      title: typeof item.episode.title === "string" ? item.episode.title : null,
      tmdbId: normalizeNumberId(item.episode.ids?.tmdb),
      traktId: normalizeTraktId(item.episode.ids?.trakt),
    },
    item,
    show,
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

export function toRemoteTraktShowWatchlistState(
  item: TraktWatchlistShow,
): RemoteTraktShowWatchlistState | null {
  const show = toRemoteTraktShowState(item.show);

  if (!show) {
    return null;
  }

  return {
    ...show,
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

export function toRemoteTraktShowRatingState(
  item: TraktRatedShow,
): RemoteTraktShowRatingState | null {
  const show = toRemoteTraktShowState(item.show);

  if (!show || !Number.isInteger(item.rating)) {
    return null;
  }

  return {
    ...show,
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

function releaseYear(value: string | null) {
  if (!value) {
    return null;
  }

  const year = Number(value.slice(0, 4));

  return Number.isInteger(year) ? year : null;
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
