import "server-only";

import { isAppError } from "@/lib/errors";
import {
  discoverTmdbMovies,
  discoverTmdbMoviesWithAuth,
  getTmdbCollectionDetails,
  getTmdbCollectionDetailsWithAuth,
  getTmdbMovieDetailsWithAppendedResponses,
  getTmdbMovieDetailsWithAppendedResponsesWithAuth,
  type TmdbAuth,
  type TmdbMovieCredits,
  type TmdbMovieDetails,
  type TmdbMovieDetailsWithAppendedResponses,
  type TmdbMovieKeywordsResponse,
  type TmdbMovieListResponse,
  type TmdbMovieSearchResult,
} from "@/lib/providers/tmdb/client";

export type RelatedTmdbMovie = {
  id: number;
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
};

const relatedMovieLimit = 12;
const discoverVoteFloor = 35;

type RelatedTmdbMovieContext = {
  auth?: TmdbAuth;
  credits?: TmdbMovieCredits | null;
  detail?: TmdbMovieDetailsWithRelatedResponses | null;
  keywords?: TmdbMovieKeywordsResponse | null;
  recommendations?: TmdbMovieListResponse | null;
  similar?: TmdbMovieListResponse | null;
};

type TmdbMovieDetailsWithRelatedResponses = TmdbMovieDetailsWithAppendedResponses | TmdbMovieDetails;

const primaryRelatedAppendToResponse = [
  "credits",
  "keywords",
  "recommendations",
  "similar",
] as const;

export type RelatedSource =
  | "collection"
  | "keyword-discover"
  | "people-discover"
  | "recommendations"
  | "similar";

type RelatedCandidate = RelatedTmdbMovie & {
  genres: number[];
  originalLanguage: string | null;
  popularity: number | null;
  releaseDate: string | null;
  score: number;
  sourceCount: number;
  voteAverage: number | null;
  voteCount: number | null;
};

export async function getRelatedTmdbMovies(
  tmdbId: number,
  context: RelatedTmdbMovieContext = {},
): Promise<RelatedTmdbMovie[]> {
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return [];
  }

  const auth = context.auth;
  const detail = context.detail ?? (await expectedErrorAsNull(
    auth
      ? getTmdbMovieDetailsWithAppendedResponsesWithAuth(
        auth,
        tmdbId,
        [...primaryRelatedAppendToResponse],
      )
      : getTmdbMovieDetailsWithAppendedResponses(tmdbId, [...primaryRelatedAppendToResponse]),
  ));
  const credits = context.credits ?? appendedCredits(detail);
  const keywords = context.keywords ?? appendedKeywords(detail);
  const recommendations = context.recommendations ?? appendedRecommendations(detail);
  const similar = context.similar ?? appendedSimilar(detail);

  const seed = toRelatedSeed(detail, credits, keywords);
  const secondarySources = await loadSecondarySources(seed, auth);

  return rankRelatedMovies(tmdbId, seed, [
    { source: "recommendations", results: recommendations?.results ?? [] },
    { source: "similar", results: similar?.results ?? [] },
    ...secondarySources,
  ]).slice(0, relatedMovieLimit);
}

export function rankRelatedMovies(
  tmdbId: number,
  seed: RelatedSeed,
  sources: Array<{ source: RelatedSource; results: TmdbMovieSearchResult[] }>,
): RelatedTmdbMovie[] {
  const candidates = new Map<number, RelatedCandidate>();

  for (const { source, results } of sources) {
    results.forEach((movie, index) => {
      const normalized = toCandidateMovie(movie);

      if (!normalized || normalized.id === tmdbId || movie.adult) {
        return;
      }

      const score = scoreMovie(normalized, seed, source, index);
      const existing = candidates.get(normalized.id);

      if (existing) {
        existing.score += score * 0.72;
        existing.sourceCount += 1;
        return;
      }

      candidates.set(normalized.id, {
        ...normalized,
        score,
        sourceCount: 1,
      });
    });
  }

  return [...candidates.values()]
    .map((movie) => ({
      ...movie,
      score: movie.score + sourceCountBonus(movie.sourceCount),
    }))
    .sort(compareCandidates)
    .map(({ id, title, posterPath, releaseYear }) => ({
      id,
      title,
      posterPath,
      releaseYear,
    }));
}

export type RelatedSeed = {
  collectionId: number | null;
  crewIds: number[];
  genreIds: number[];
  keywordIds: number[];
  originalLanguage: string | null;
  peopleIds: number[];
  releaseYear: number | null;
};

async function loadSecondarySources(seed: RelatedSeed, auth?: TmdbAuth) {
  const secondarySources: Array<
    Promise<{ source: RelatedSource; results: TmdbMovieSearchResult[] } | null>
  > = [];

  if (seed.collectionId) {
    secondarySources.push(
      expectedErrorAsNull(
        auth
          ? getTmdbCollectionDetailsWithAuth(auth, seed.collectionId)
          : getTmdbCollectionDetails(seed.collectionId),
      ).then((collection) =>
        collection ? { source: "collection" as const, results: collection.parts ?? [] } : null,
      ),
    );
  }

  if (seed.keywordIds.length > 0) {
    secondarySources.push(
      expectedErrorAsNull(tmdbDiscoverMovies(auth, {
        sortBy: "vote_count.desc",
        voteCountGte: discoverVoteFloor,
        withGenres: joinOr(seed.genreIds.slice(0, 3)),
        withKeywords: joinOr(seed.keywordIds.slice(0, 6)),
        withOriginalLanguage: discoverLanguage(seed.originalLanguage),
      })).then((response) =>
        response
          ? { source: "keyword-discover" as const, results: response.results }
          : null,
      ),
    );
  }

  if (seed.peopleIds.length > 0 || seed.crewIds.length > 0) {
    secondarySources.push(
      expectedErrorAsNull(tmdbDiscoverMovies(auth, {
        primaryReleaseDateGte: releaseDateBound(seed.releaseYear, -15),
        primaryReleaseDateLte: releaseDateBound(seed.releaseYear, 15),
        sortBy: "popularity.desc",
        voteCountGte: discoverVoteFloor,
        withGenres: joinOr(seed.genreIds.slice(0, 3)),
        withPeople: joinOr(seed.peopleIds.slice(0, 6)),
      })).then((response) =>
        response
          ? { source: "people-discover" as const, results: response.results }
          : null,
      ),
    );
  }

  return (await Promise.all(secondarySources)).filter(
    (source): source is { source: RelatedSource; results: TmdbMovieSearchResult[] } =>
      source !== null,
  );
}

function appendedCredits(detail: TmdbMovieDetailsWithRelatedResponses | null) {
  return detail && "credits" in detail ? detail.credits ?? null : null;
}

function appendedKeywords(detail: TmdbMovieDetailsWithRelatedResponses | null) {
  return detail && "keywords" in detail ? detail.keywords ?? null : null;
}

function appendedRecommendations(detail: TmdbMovieDetailsWithRelatedResponses | null) {
  return detail && "recommendations" in detail ? detail.recommendations ?? null : null;
}

function appendedSimilar(detail: TmdbMovieDetailsWithRelatedResponses | null) {
  return detail && "similar" in detail ? detail.similar ?? null : null;
}

function tmdbDiscoverMovies(auth: TmdbAuth | undefined, options: Parameters<typeof discoverTmdbMovies>[0]) {
  return auth ? discoverTmdbMoviesWithAuth(auth, options) : discoverTmdbMovies(options);
}

function toRelatedSeed(
  detail: TmdbMovieDetails | null,
  credits: TmdbMovieCredits | null,
  keywords: TmdbMovieKeywordsResponse | null,
): RelatedSeed {
  const crewIds = uniqueNumbers(
    (credits?.crew ?? [])
      .filter((member) => {
        const job = normalizeText(member.job)?.toLowerCase();
        return job === "director" || job === "writer" || job === "screenplay";
      })
      .map((member) => member.id),
  );
  const castIds = uniqueNumbers(
    (credits?.cast ?? [])
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
      .map((member) => member.id),
  );
  const releaseDate = normalizeDate(detail?.release_date);

  return {
    collectionId: validId(detail?.belongs_to_collection?.id),
    crewIds,
    genreIds: uniqueNumbers((detail?.genres ?? []).map((genre) => genre.id)),
    keywordIds: uniqueNumbers((keywords?.keywords ?? []).map((keyword) => keyword.id)),
    originalLanguage: normalizeText(detail?.original_language),
    peopleIds: uniqueNumbers([...crewIds, ...castIds]),
    releaseYear: releaseYear(releaseDate),
  };
}

function toCandidateMovie(
  movie: TmdbMovieSearchResult,
): Omit<RelatedCandidate, "score" | "sourceCount"> | null {
  const title = normalizeText(movie.title);

  if (!title || movie.id < 1) {
    return null;
  }

  const releaseDate = normalizeDate(movie.release_date);

  return {
    genres: movie.genre_ids ?? [],
    id: movie.id,
    originalLanguage: normalizeText(movie.original_language),
    popularity: finiteNumber(movie.popularity),
    posterPath: movie.poster_path ?? null,
    releaseDate,
    releaseYear: releaseYear(releaseDate),
    title,
    voteAverage: finiteNumber(movie.vote_average),
    voteCount: finiteNumber(movie.vote_count),
  };
}

function scoreMovie(
  movie: Omit<RelatedCandidate, "score" | "sourceCount">,
  seed: RelatedSeed,
  source: RelatedSource,
  index: number,
) {
  let score = sourceScore(source) + Math.max(0, 26 - index * 1.8);
  const sharedGenres = countShared(movie.genres, seed.genreIds);

  score += Math.min(sharedGenres, 3) * 8;

  if (seed.originalLanguage && movie.originalLanguage === seed.originalLanguage) {
    score += seed.originalLanguage === "en" ? 3 : 9;
  }

  if (seed.releaseYear && movie.releaseYear) {
    const distance = Math.abs(seed.releaseYear - movie.releaseYear);
    score += distance <= 2 ? 10 : distance <= 5 ? 7 : distance <= 10 ? 4 : 0;
  }

  if (movie.posterPath) {
    score += 3;
  } else {
    score -= 8;
  }

  if (movie.voteAverage) {
    score += Math.min(8, movie.voteAverage);
  }

  if (movie.voteCount) {
    score += movie.voteCount >= 1000
      ? 8
      : movie.voteCount >= 250
        ? 5
        : movie.voteCount >= 50
          ? 2
          : 0;
  }

  if (movie.popularity) {
    score += Math.min(8, Math.log2(movie.popularity + 1));
  }

  return score;
}

function sourceScore(source: RelatedSource) {
  switch (source) {
    case "collection":
      return 250;
    case "keyword-discover":
      return 118;
    case "people-discover":
      return 94;
    case "recommendations":
      return 84;
    case "similar":
      return 72;
  }
}

function sourceCountBonus(sourceCount: number) {
  return sourceCount > 1 ? (sourceCount - 1) * 18 : 0;
}

function compareCandidates(a: RelatedCandidate, b: RelatedCandidate) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  const voteCountDelta = (b.voteCount ?? 0) - (a.voteCount ?? 0);

  if (voteCountDelta !== 0) {
    return voteCountDelta;
  }

  const popularityDelta = (b.popularity ?? 0) - (a.popularity ?? 0);

  if (popularityDelta !== 0) {
    return popularityDelta;
  }

  return a.title.localeCompare(b.title);
}

async function expectedErrorAsNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (isExpectedRelatedMovieError(error)) {
      return null;
    }

    throw error;
  }
}

function validId(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const value of values) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

function countShared(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const bSet = new Set(b);
  return a.filter((value) => bSet.has(value)).length;
}

function joinOr(values: number[]) {
  return values.length > 0 ? values.join("|") : null;
}

function discoverLanguage(language: string | null) {
  return language && language !== "en" ? language : null;
}

function releaseDateBound(year: number | null, offset: number) {
  return year ? `${year + offset}-01-01` : null;
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
