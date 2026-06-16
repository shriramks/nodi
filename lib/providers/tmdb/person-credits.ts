import type {
  TmdbPersonCombinedCredits,
  TmdbPersonCredit,
} from "@/lib/providers/tmdb/client";

export type RelevantPersonMovie = {
  id: number;
  mediaType: "movie";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseYear: number | null;
  role: string | null;
};

type RelevantPersonMovieWithScore = RelevantPersonMovie & {
  score: number;
};

type RelevantPersonMovieOptions = {
  limit?: number;
  sourceMovieId?: number | null;
};

export function toRelevantPersonMovies(
  credits: TmdbPersonCombinedCredits,
  { limit = 12, sourceMovieId = null }: RelevantPersonMovieOptions = {},
): RelevantPersonMovie[] {
  const merged = [...(credits.cast ?? []), ...(credits.crew ?? [])]
    .filter((credit) => credit.id > 0 && credit.media_type === "movie")
    .map((credit) => toRelevantPersonMovie(credit, sourceMovieId))
    .filter((credit): credit is RelevantPersonMovieWithScore => credit !== null);
  const byMovie = new Map<number, RelevantPersonMovieWithScore>();

  for (const credit of merged) {
    const existing = byMovie.get(credit.id);

    if (!existing || credit.score > existing.score) {
      byMovie.set(credit.id, credit);
    }
  }

  return Array.from(byMovie.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ id, mediaType, title, posterPath, backdropPath, releaseYear, role }) => ({
      id,
      mediaType,
      title,
      posterPath,
      backdropPath,
      releaseYear,
      role,
    }));
}

/**
 * The single most notable credit a person is known for, across both film and TV.
 * Used for the "Known for ..." headline, so it must include TV (e.g. Lost) which
 * {@link toRelevantPersonMovies} deliberately drops.
 */
export function topPersonCreditTitle(credits: TmdbPersonCombinedCredits): string | null {
  const candidates = [...(credits.cast ?? []), ...(credits.crew ?? [])].filter(
    (credit) =>
      credit.id > 0 && (credit.media_type === "movie" || credit.media_type === "tv"),
  );

  let best: { title: string; score: number } | null = null;
  for (const credit of candidates) {
    const title = normalizeText(credit.title) ?? normalizeText(credit.name);
    if (!title) {
      continue;
    }

    const score = personMovieScore(credit, null);
    if (!best || score > best.score) {
      best = { title, score };
    }
  }

  return best?.title ?? null;
}

function toRelevantPersonMovie(
  credit: TmdbPersonCredit,
  sourceMovieId: number | null,
): RelevantPersonMovieWithScore | null {
  const title = normalizeText(credit.title);
  if (!title) {
    return null;
  }

  const role = normalizeText(credit.character) ?? normalizeText(credit.job);

  return {
    id: credit.id,
    mediaType: "movie",
    title,
    posterPath: credit.poster_path ?? null,
    backdropPath: credit.backdrop_path ?? null,
    releaseYear: releaseYear(normalizeDate(credit.release_date)),
    role,
    score: personMovieScore(credit, sourceMovieId),
  };
}

function personMovieScore(credit: TmdbPersonCredit, sourceMovieId: number | null) {
  if (sourceMovieId && credit.id === sourceMovieId) {
    return 10_000;
  }

  const popularity = typeof credit.popularity === "number" ? credit.popularity : 0;
  const votes = typeof credit.vote_count === "number" ? Math.min(credit.vote_count, 10_000) / 500 : 0;
  const rating = typeof credit.vote_average === "number" ? credit.vote_average : 0;
  const castOrderBonus = typeof credit.order === "number" ? Math.max(0, 24 - credit.order * 2) : 0;
  const roleBonus = normalizeText(credit.character) || normalizeText(credit.job) ? 4 : 0;
  const posterBonus = credit.poster_path ? 8 : 0;
  const backdropBonus = credit.backdrop_path ? 4 : 0;

  return popularity + votes + rating + castOrderBonus + roleBonus + posterBonus + backdropBonus;
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
