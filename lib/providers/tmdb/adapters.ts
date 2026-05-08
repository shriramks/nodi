import type { MoviePayload } from "@/lib/db/validation";
import type { MovieStatus } from "@/lib/db/types";
import type {
  TmdbMovieCredits,
  TmdbMovieDetails,
  TmdbMovieSearchResponse,
  TmdbMovieSearchResult,
} from "@/lib/providers/tmdb/client";

export type LocalMovieSearchState = {
  localMovieId: string;
  currentStatus: MovieStatus | null;
  personalRating: number | null;
};

export type MovieSearchResult = {
  tmdbId: number;
  localMovieId: string | null;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  originalLanguage: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overviewSnippet: string | null;
  genreIds: number[];
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
  results: MovieSearchResult[];
};

export type MovieCastPayload = {
  tmdb_person_id: number;
  name: string;
  character_name: string | null;
  profile_path: string | null;
  cast_order: number | null;
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
    tmdbId: result.id,
    localMovieId: localState?.localMovieId ?? null,
    title: result.title,
    originalTitle: normalizeText(result.original_title),
    releaseDate,
    releaseYear: releaseYear(releaseDate),
    originalLanguage: normalizeText(result.original_language),
    posterPath: result.poster_path ?? null,
    backdropPath: result.backdrop_path ?? null,
    overviewSnippet: overviewSnippet(result.overview),
    genreIds: result.genre_ids ?? [],
    alreadyInLibrary: Boolean(localState?.currentStatus),
    currentStatus: localState?.currentStatus ?? null,
    personalRating: localState?.personalRating ?? null,
    detailUrl: `/movie/tmdb/${result.id}`,
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
