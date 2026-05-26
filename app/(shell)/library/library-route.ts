import type { MediaTypeFilter } from "@/lib/db/types";

export const libraryTypes = ["all", "movie", "show"] as const;
export type LibraryTypeFilter = MediaTypeFilter;
const ratingOps = [">=", ">", "=", "<", "<="] as const;

export type LibrarySearchParams = Record<string, string | string[] | undefined>;

export function parseLibraryType(value: string | undefined): LibraryTypeFilter {
  return libraryTypes.find((type) => type === value) ?? "all";
}

export function parseMovieFilters(params: LibrarySearchParams) {
  const ratingOp = parseRatingOp(firstParam(params.ratingOp)) ?? ">=";
  const ratingVal = parseRating(firstParam(params.rating));
  const month = parseMonth(firstParam(params.month));
  const year = month ? undefined : parseYear(firstParam(params.year));

  return {
    genre: cleanParam(firstParam(params.genre)),
    language: cleanParam(firstParam(params.language))?.toLowerCase(),
    tags: allParams(params.tag).map((tag) => tag.trim()).filter(Boolean),
    ratingOp,
    ratingVal,
    year,
    month,
  };
}

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function allParams(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

export function cleanParam(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

export function safeStatsHref(value: string | undefined) {
  return value?.startsWith("/stats") ? value : "/stats";
}

export function queryHref(
  pathname: string,
  params: LibrarySearchParams,
  overrides: Record<string, string | null>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key in overrides) {
      continue;
    }

    for (const item of allParams(value)) {
      query.append(key, item);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    query.delete(key);
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

function parseRatingOp(value: string | undefined) {
  return ratingOps.find((op) => op === value);
}

function parseRating(value: string | undefined) {
  if (!value) {
    return null;
  }

  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return null;
  }
  return rating;
}

function parseYear(value: string | undefined) {
  return value && /^\d{4}$/.test(value) ? value : undefined;
}

function parseMonth(value: string | undefined) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined;
}
