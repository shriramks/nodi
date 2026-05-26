import type { MoviePayload } from "@/lib/db/validation";
import type { MediaStatus, MovieStatus } from "@/lib/db/types";
import type {
  TmdbMovieCredits,
  TmdbMovieDetails,
  TmdbMovieSearchResponse,
  TmdbMovieSearchResult,
  TmdbTvDetails,
  TmdbTvEpisodeDetails,
  TmdbTvSearchResponse,
  TmdbTvSearchResult,
  TmdbTvSeasonDetails,
} from "@/lib/providers/tmdb/client";

export type LocalMovieSearchState = {
  localMovieId: string;
  currentStatus: MovieStatus | null;
  personalRating: number | null;
};

export type LocalMediaSearchState = {
  localMediaId: string;
  currentStatus: MediaStatus | null;
  personalRating: number | null;
};

export type MovieSearchResult = {
  mediaType: "movie";
  tmdbId: number;
  localMovieId: string | null;
  localMediaId: string | null;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  firstAirDate: null;
  firstAirYear: null;
  originalLanguage: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overviewSnippet: string | null;
  genreIds: number[];
  popularity: number | null;
  alreadyInLibrary: boolean;
  currentStatus: MovieStatus | null;
  personalRating: number | null;
  detailUrl: string;
};

export type MovieSearchResponse = {
  query: string;
  page: number;
  totalPages: number;
  totalResults: number;
  results: MediaSearchResult[];
};

export type TvSearchResult = {
  mediaType: "show";
  tmdbId: number;
  localMediaId: string | null;
  title: string;
  originalTitle: string | null;
  releaseDate: null;
  releaseYear: null;
  firstAirDate: string | null;
  firstAirYear: number | null;
  originalLanguage: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overviewSnippet: string | null;
  genreIds: number[];
  popularity: number | null;
  alreadyInLibrary: boolean;
  currentStatus: MediaStatus | null;
  personalRating: number | null;
  detailUrl: string;
  tmdbVoteAverage: number | null;
  tmdbVoteCount: number | null;
};

export type MediaSearchResult = MovieSearchResult | TvSearchResult;

export type TvSearchResponse = {
  query: string;
  page: number;
  totalPages: number;
  totalResults: number;
  results: TvSearchResult[];
};

export type MovieCastPayload = {
  tmdb_person_id: number;
  name: string;
  character_name: string | null;
  profile_path: string | null;
  cast_order: number | null;
};

export type TmdbMovieIngestPayload = {
  movie: MoviePayload;
  cast: MovieCastPayload[];
};

export type TmdbShowPayload = {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  firstAirDate: string | null;
  primaryGenreId: number | null;
  primaryGenreName: string | null;
  originalLanguage: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  runtimeMinutes: number | null;
  tmdbVoteAverage: number | null;
  tmdbVoteCount: number | null;
  popularity: number | null;
  studio: string | null;
  network: string | null;
  seasonCount: number | null;
  episodeCount: number | null;
};

export type TmdbEpisodePayload = {
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string | null;
  runtimeMinutes: number | null;
  overview: string | null;
  posterPath: string | null;
  stillPath: string | null;
};

export type TmdbShowIngestPayload = {
  show: TmdbShowPayload;
  episodes: TmdbEpisodePayload[];
};

function releaseYear(releaseDate: string | null | undefined) {
  if (!releaseDate) {
    return null;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}

function normalizeDate(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function oneDecimal(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

function overviewSnippet(overview: string | null | undefined) {
  const normalized = normalizeText(overview)?.replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177).trim()}...` : normalized;
}

export function toMovieSearchResponse(
  query: string,
  response: TmdbMovieSearchResponse,
  localStateByTmdbId: Map<number, LocalMovieSearchState>,
): MovieSearchResponse {
  return {
    query,
    page: response.page,
    totalPages: response.total_pages,
    totalResults: response.total_results,
    results: response.results.map((result) =>
      toMovieSearchResult(result, localStateByTmdbId.get(result.id) ?? null),
    ),
  };
}

export function toMovieSearchResult(
  result: TmdbMovieSearchResult,
  localState: LocalMovieSearchState | null,
): MovieSearchResult {
  const releaseDate = normalizeDate(result.release_date);

  return {
    mediaType: "movie",
    tmdbId: result.id,
    localMovieId: localState?.localMovieId ?? null,
    localMediaId: localState?.localMovieId ?? null,
    title: result.title,
    originalTitle: normalizeText(result.original_title),
    releaseDate,
    releaseYear: releaseYear(releaseDate),
    firstAirDate: null,
    firstAirYear: null,
    originalLanguage: normalizeText(result.original_language),
    posterPath: result.poster_path ?? null,
    backdropPath: result.backdrop_path ?? null,
    overviewSnippet: overviewSnippet(result.overview),
    genreIds: result.genre_ids ?? [],
    popularity: result.popularity ?? null,
    alreadyInLibrary: Boolean(localState?.currentStatus),
    currentStatus: localState?.currentStatus ?? null,
    personalRating: localState?.personalRating ?? null,
    detailUrl: `/movie/tmdb/${result.id}`,
  };
}

export function toTvSearchResponse(
  query: string,
  response: TmdbTvSearchResponse,
  localStateByTmdbId: Map<number, LocalMediaSearchState> = new Map(),
): TvSearchResponse {
  return {
    query,
    page: response.page,
    totalPages: response.total_pages,
    totalResults: response.total_results,
    results: response.results.map((result) =>
      toTvSearchResult(result, localStateByTmdbId.get(result.id) ?? null),
    ),
  };
}

export function toTvSearchResult(
  result: TmdbTvSearchResult,
  localState: LocalMediaSearchState | null = null,
): TvSearchResult {
  const firstAirDate = normalizeDate(result.first_air_date);

  return {
    mediaType: "show",
    tmdbId: result.id,
    localMediaId: localState?.localMediaId ?? null,
    title: normalizeText(result.name) ?? "Untitled show",
    originalTitle: normalizeText(result.original_name),
    releaseDate: null,
    releaseYear: null,
    firstAirDate,
    firstAirYear: releaseYear(firstAirDate),
    originalLanguage: normalizeText(result.original_language),
    posterPath: result.poster_path ?? null,
    backdropPath: result.backdrop_path ?? null,
    overviewSnippet: overviewSnippet(result.overview),
    genreIds: result.genre_ids ?? [],
    popularity: result.popularity ?? null,
    alreadyInLibrary: Boolean(localState?.currentStatus),
    currentStatus: localState?.currentStatus ?? null,
    personalRating: localState?.personalRating ?? null,
    detailUrl: `/show/tmdb/${result.id}`,
    tmdbVoteAverage: oneDecimal(result.vote_average),
    tmdbVoteCount: result.vote_count ?? null,
  };
}

export function toMoviePayload(detail: TmdbMovieDetails): MoviePayload {
  const primaryGenre = detail.genres?.[0] ?? null;

  return {
    tmdbId: detail.id,
    imdbId: normalizeText(detail.imdb_id),
    title: normalizeText(detail.title) ?? "Untitled movie",
    originalTitle: normalizeText(detail.original_title),
    releaseDate: normalizeDate(detail.release_date),
    primaryGenreId: primaryGenre?.id ?? null,
    primaryGenreName: normalizeText(primaryGenre?.name),
    originalLanguage: normalizeText(detail.original_language),
    overview: normalizeText(detail.overview),
    posterPath: detail.poster_path ?? null,
    backdropPath: detail.backdrop_path ?? null,
    runtimeMinutes: detail.runtime && detail.runtime > 0 ? detail.runtime : null,
    tmdbVoteAverage: oneDecimal(detail.vote_average),
    tmdbVoteCount: detail.vote_count ?? null,
    popularity: detail.popularity ?? null,
  };
}

export function toShowPayload(detail: TmdbTvDetails): TmdbShowPayload {
  const primaryGenre = detail.genres?.[0] ?? null;
  const runtime = detail.episode_run_time?.find((value) => value > 0) ?? null;

  return {
    tmdbId: detail.id,
    title: normalizeText(detail.name) ?? "Untitled show",
    originalTitle: normalizeText(detail.original_name),
    firstAirDate: normalizeDate(detail.first_air_date),
    primaryGenreId: primaryGenre?.id ?? null,
    primaryGenreName: normalizeText(primaryGenre?.name),
    originalLanguage: normalizeText(detail.original_language),
    overview: normalizeText(detail.overview),
    posterPath: detail.poster_path ?? null,
    backdropPath: detail.backdrop_path ?? null,
    runtimeMinutes: runtime,
    tmdbVoteAverage: oneDecimal(detail.vote_average),
    tmdbVoteCount: detail.vote_count ?? null,
    popularity: detail.popularity ?? null,
    studio: normalizeText(detail.production_companies?.[0]?.name),
    network: normalizeText(detail.networks?.[0]?.name),
    seasonCount: detail.number_of_seasons ?? null,
    episodeCount: detail.number_of_episodes ?? null,
  };
}

export function toEpisodePayload(
  episode: TmdbTvEpisodeDetails,
  seasonPosterPath: string | null = null,
): TmdbEpisodePayload {
  return {
    tmdbId: episode.id,
    seasonNumber: episode.season_number,
    episodeNumber: episode.episode_number,
    title: normalizeText(episode.name) ?? `Episode ${episode.episode_number}`,
    airDate: normalizeDate(episode.air_date),
    runtimeMinutes: episode.runtime && episode.runtime > 0 ? episode.runtime : null,
    overview: normalizeText(episode.overview),
    posterPath: seasonPosterPath,
    stillPath: episode.still_path ?? null,
  };
}

export function toSeasonEpisodePayloads(season: TmdbTvSeasonDetails): TmdbEpisodePayload[] {
  return (season.episodes ?? [])
    .filter((episode) => episode.id > 0 && episode.season_number >= 0 && episode.episode_number > 0)
    .sort((a, b) => {
      if (a.season_number !== b.season_number) {
        return a.season_number - b.season_number;
      }

      return a.episode_number - b.episode_number;
    })
    .map((episode) => toEpisodePayload(episode, season.poster_path ?? null));
}

export function toMovieCastPayloads(credits: TmdbMovieCredits, limit = 12): MovieCastPayload[] {
  return (credits.cast ?? [])
    .filter((member) => member.id > 0 && normalizeText(member.name))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .slice(0, limit)
    .map((member) => ({
      tmdb_person_id: member.id,
      name: normalizeText(member.name) ?? "Unknown",
      character_name: normalizeText(member.character),
      profile_path: member.profile_path ?? null,
      cast_order: member.order ?? null,
    }));
}

export function toTmdbMovieIngestPayload(
  detail: TmdbMovieDetails,
  credits: TmdbMovieCredits,
): TmdbMovieIngestPayload {
  return {
    movie: toMoviePayload(detail),
    cast: toMovieCastPayloads(credits),
  };
}

export function toTmdbShowIngestPayload(
  detail: TmdbTvDetails,
  seasons: TmdbTvSeasonDetails[] = [],
): TmdbShowIngestPayload {
  const episodesByKey = new Map<string, TmdbEpisodePayload>();

  seasons.flatMap(toSeasonEpisodePayloads).forEach((episode) => {
    episodesByKey.set(`${episode.seasonNumber}:${episode.episodeNumber}`, episode);
  });

  return {
    show: toShowPayload(detail),
    episodes: Array.from(episodesByKey.values()),
  };
}
