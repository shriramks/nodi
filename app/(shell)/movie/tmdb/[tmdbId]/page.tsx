import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MovieDetailView } from "@/components/movie/movie-detail-view";
import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { isAppError, AppError } from "@/lib/errors";
import { toMovieCastPayloads } from "@/lib/providers/tmdb/adapters";
import {
  getTmdbMovieCredits,
  getTmdbMovieDetails,
  type TmdbMovieCredits,
  type TmdbMovieDetails,
} from "@/lib/providers/tmdb/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TmdbUserStateActions } from "./tmdb-movie-detail-client";

type TmdbMovieDetailPageProps = {
  params: Promise<{ tmdbId: string }>;
};

export async function generateMetadata({
  params,
}: TmdbMovieDetailPageProps): Promise<Metadata> {
  try {
    const { tmdbId: rawTmdbId } = await params;
    const tmdbId = normalizeTmdbId(rawTmdbId);
    const detail = await getTmdbMovieDetails(tmdbId);
    return { title: detail.title };
  } catch {
    return { title: "Movie" };
  }
}

export default async function TmdbMovieDetailPage({
  params,
}: TmdbMovieDetailPageProps) {
  const { tmdbId: rawTmdbId } = await params;
  const tmdbId = normalizeTmdbId(rawTmdbId);
  await redirectIfSaved(tmdbId);
  const [detail, credits] = await loadTmdbMovieOrNotFound(tmdbId);

  return (
    <MovieDetailView
      actions={<TmdbUserStateActions tmdbId={tmdbId} />}
      movie={toDetailMovie(detail, credits)}
      status={null}
    />
  );
}

async function redirectIfSaved(tmdbId: number) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: movie, error: movieError } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (movieError) {
    throwDatabaseError("Failed to check local movie state.", movieError);
  }

  if (!movie) {
    return;
  }

  const { data: userMovie, error: userMovieError } = await supabase
    .from("user_movies")
    .select("movie_id")
    .eq("user_id", user.id)
    .eq("movie_id", movie.id)
    .maybeSingle();

  if (userMovieError) {
    throwDatabaseError("Failed to check user movie state.", userMovieError);
  }

  if (userMovie) {
    redirect(`/movie/${movie.id}`);
  }
}

async function loadTmdbMovieOrNotFound(tmdbId: number) {
  try {
    return await Promise.all([
      getTmdbMovieDetails(tmdbId),
      getTmdbMovieCredits(tmdbId),
    ]);
  } catch (error) {
    if (isAppError(error) && error.status === 404) {
      notFound();
    }

    throw error;
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

function toDetailMovie(detail: TmdbMovieDetails, credits: TmdbMovieCredits) {
  const primaryGenre = detail.genres?.[0] ?? null;
  const releaseDate = normalizeDate(detail.release_date);

  return {
    title: normalizeText(detail.title) ?? "Untitled movie",
    poster_path: detail.poster_path ?? null,
    release_date: releaseDate,
    release_year: releaseYear(releaseDate),
    original_language: normalizeText(detail.original_language),
    primary_genre_name: normalizeText(primaryGenre?.name),
    overview: normalizeText(detail.overview),
    runtime_minutes: detail.runtime && detail.runtime > 0 ? detail.runtime : null,
    tmdb_vote_average: oneDecimal(detail.vote_average),
    tmdb_vote_count: detail.vote_count ?? null,
    cast: toMovieCastPayloads(credits).map((member) => ({
      id: `${member.tmdb_person_id}-${member.cast_order ?? "x"}-${member.character_name ?? ""}`,
      name: member.name,
      character_name: member.character_name,
      profile_path: member.profile_path,
    })),
  };
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

function releaseYear(releaseDate: string | null) {
  if (!releaseDate) {
    return null;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}
