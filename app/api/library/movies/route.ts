import { NextResponse, type NextRequest } from "next/server";

import {
  listMediaLibraryMoviesPage,
  type LibraryMovieSortDirection,
  type LibraryMovieSortKey,
} from "@/lib/db/queries";
import type { MovieStatus } from "@/lib/db/types";
import { isAppError } from "@/lib/errors";

const pageSize = 48;
const maximumOffset = 10_000;
const ratingOps = [">=", ">", "=", "<", "<="] as const;
const sortKeys = ["watched_date", "added_date", "rating", "title"] as const;
const sortDirections = ["asc", "desc"] as const;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const status = parseStatus(params.get("status"));

    if (!status) {
      return NextResponse.json({ error: "A valid library status is required." }, { status: 400 });
    }

    const page = await listMediaLibraryMoviesPage({
      status,
      limit: pageSize,
      offset: parseOffset(params.get("offset")),
      sort: {
        key: parseSortKey(status, params.get("sortKey")),
        direction: parseSortDirection(params.get("sortDir")),
      },
      filters: {
        genre: cleanParam(params.get("genre")),
        language: cleanParam(params.get("language"))?.toLowerCase(),
        tagNames: params.getAll("tag").map((tag) => tag.trim()).filter(Boolean),
        rating: parseRatingFilter(params.get("ratingOp"), params.get("rating")),
        watchedYear: parseYear(params.get("year")),
        watchedMonth: parseMonth(params.get("month")),
      },
    });

    return NextResponse.json(page);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to load library movies." }, { status: 500 });
  }
}

function parseStatus(value: string | null): MovieStatus | null {
  return value === "watched" || value === "to_watch" ? value : null;
}

function parseOffset(value: string | null) {
  const offset = Number(value ?? 0);

  if (!Number.isInteger(offset)) {
    return 0;
  }

  return Math.min(Math.max(offset, 0), maximumOffset);
}

function parseSortKey(status: MovieStatus, value: string | null): LibraryMovieSortKey {
  if (sortKeys.some((key) => key === value)) {
    return value as LibraryMovieSortKey;
  }

  return status === "to_watch" ? "added_date" : "watched_date";
}

function parseSortDirection(value: string | null): LibraryMovieSortDirection {
  return sortDirections.some((direction) => direction === value)
    ? (value as LibraryMovieSortDirection)
    : "desc";
}

function parseRatingFilter(opValue: string | null, ratingValue: string | null) {
  const op = ratingOps.find((candidate) => candidate === opValue);
  const rating = Number(ratingValue);

  if (!op || !Number.isInteger(rating) || rating < 1 || rating > 10) {
    return undefined;
  }

  return { op, value: rating };
}

function cleanParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

function parseYear(value: string | null) {
  return value && /^\d{4}$/.test(value) ? value : undefined;
}

function parseMonth(value: string | null) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined;
}
