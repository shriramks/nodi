import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { AUTH_ROUTE } from "@/lib/auth/paths";
import { ingestTmdbMovie } from "@/lib/db/mutations";
import { AppError, isAppError } from "@/lib/errors";
import {
  getTmdbMovieCredits,
  getTmdbMovieDetails,
} from "@/lib/providers/tmdb/client";

type TmdbMovieRouteContext = {
  params: Promise<{
    tmdbId: string;
  }>;
};

export async function GET(request: NextRequest, context: TmdbMovieRouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    const signInUrl = new URL(AUTH_ROUTE, request.url);
    signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  try {
    const { tmdbId: rawTmdbId } = await context.params;
    const tmdbId = normalizeTmdbId(rawTmdbId);
    const language = normalizeLanguage(request.nextUrl.searchParams.get("language"));
    const [detail, credits] = await Promise.all([
      getTmdbMovieDetails(tmdbId, language),
      getTmdbMovieCredits(tmdbId, language),
    ]);
    const movie = await ingestTmdbMovie(detail, credits);
    const detailUrl = `/movie/${movie.id}`;

    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({
        movieId: movie.id,
        tmdbId: movie.tmdb_id,
        detailUrl,
      });
    }

    return NextResponse.redirect(new URL(detailUrl, request.url));
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Failed to ingest TMDB movie." },
      { status: 500 },
    );
  }
}

function normalizeTmdbId(value: string) {
  const tmdbId = Number(value);

  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    throw new AppError("Invalid TMDB movie id.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return tmdbId;
}

function normalizeLanguage(value: string | null) {
  if (!value) {
    return null;
  }

  return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value) ? value : null;
}
