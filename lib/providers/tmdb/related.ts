import "server-only";

import { isAppError } from "@/lib/errors";
import {
  getTmdbMovieRecommendations,
  getTmdbSimilarMovies,
  type TmdbMovieSearchResult,
} from "@/lib/providers/tmdb/client";

export type RelatedTmdbMovie = {
  id: number;
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
};

const relatedMovieLimit = 12;

export async function getRelatedTmdbMovies(tmdbId: number): Promise<RelatedTmdbMovie[]> {
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return [];
  }

  try {
    const recommendations = await getTmdbMovieRecommendations(tmdbId);
    const related = toRelatedMovies(recommendations.results);

    if (related.length >= relatedMovieLimit) {
      return related.slice(0, relatedMovieLimit);
    }

    const similar = await getTmdbSimilarMovies(tmdbId);
    return mergeRelatedMovies(related, toRelatedMovies(similar.results)).slice(0, relatedMovieLimit);
  } catch (error) {
    if (isExpectedRelatedMovieError(error)) {
      return [];
    }

    throw error;
  }
}

function toRelatedMovies(results: TmdbMovieSearchResult[] | undefined) {
  return (results ?? []).flatMap((movie) => {
    const title = normalizeText(movie.title);

    if (!title || movie.id < 1) {
      return [];
    }

    return [{
      id: movie.id,
      title,
      posterPath: movie.poster_path ?? null,
      releaseYear: releaseYear(normalizeDate(movie.release_date)),
    }];
  });
}

function mergeRelatedMovies(
  primary: RelatedTmdbMovie[],
  fallback: RelatedTmdbMovie[],
) {
  const seen = new Set(primary.map((movie) => movie.id));
  const merged = [...primary];

  for (const movie of fallback) {
    if (seen.has(movie.id)) {
      continue;
    }

    seen.add(movie.id);
    merged.push(movie);
  }

  return merged;
}

function isExpectedRelatedMovieError(error: unknown) {
  if (!isAppError(error)) {
    return false;
  }

  return (
    error.code === "TMDB_TOKEN_MISSING" ||
    error.code === "HTTP_ERROR" ||
    error.code === "NETWORK_ERROR"
  );
}

function normalizeDate(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function releaseYear(releaseDate: string | null) {
  if (!releaseDate) {
    return null;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}
