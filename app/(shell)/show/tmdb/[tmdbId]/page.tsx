import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { RemoteShowStateActions } from "@/components/show/show-state-actions";
import { ShowDetailView } from "@/components/show/show-detail-view";
import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { AppError, isAppError } from "@/lib/errors";
import { toTmdbShowIngestPayload } from "@/lib/providers/tmdb/adapters";
import {
  getTmdbTvAggregateCredits,
  getTmdbTvDetails,
  type TmdbTvAggregateCredits,
  type TmdbTvDetails,
} from "@/lib/providers/tmdb/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addTmdbShowToWishlistAction,
  saveTmdbShowToLibraryAction,
} from "../../actions";

type TmdbShowDetailPageProps = {
  params: Promise<{ tmdbId: string }>;
};

type ShowMappingRow = {
  media_id: string | null;
};

export async function generateMetadata({
  params,
}: TmdbShowDetailPageProps): Promise<Metadata> {
  try {
    const { tmdbId: rawTmdbId } = await params;
    const tmdbId = normalizeTmdbId(rawTmdbId);
    const detail = await loadTmdbShowDetail(tmdbId);
    return { title: detail.name };
  } catch {
    return { title: "Show" };
  }
}

export default async function TmdbShowDetailPage({
  params,
}: TmdbShowDetailPageProps) {
  const { tmdbId: rawTmdbId } = await params;
  const tmdbId = normalizeTmdbId(rawTmdbId);
  await redirectIfSaved(tmdbId);
  const [detail, credits] = await Promise.all([
    loadTmdbShowOrNotFound(tmdbId),
    loadTmdbShowCast(tmdbId),
  ]);
  const ingestPayload = toTmdbShowIngestPayload(detail);

  return (
    <ShowDetailView
      actions={
        <RemoteShowStateActions
          addToWishlist={addTmdbShowToWishlistAction.bind(null, ingestPayload)}
          saveToLibrary={saveTmdbShowToLibraryAction.bind(null, ingestPayload)}
        />
      }
      show={{
        ...toDetailShow(detail),
        cast: toShowCast(credits),
      }}
    />
  );
}

async function redirectIfSaved(tmdbId: number) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: mapping, error: mappingError } = await supabase
    .from("media_provider_mappings")
    .select("media_id")
    .eq("provider", "tmdb")
    .eq("provider_media_type", "show")
    .eq("provider_id", String(tmdbId))
    .maybeSingle();

  if (mappingError) {
    throwDatabaseError("Failed to check local show mapping.", mappingError);
  }

  const mediaId = (mapping as ShowMappingRow | null)?.media_id;

  if (!mediaId) {
    return;
  }

  const { data: userMedia, error: userMediaError } = await supabase
    .from("user_media")
    .select("media_id")
    .eq("user_id", user.id)
    .eq("media_id", mediaId)
    .maybeSingle();

  if (userMediaError) {
    throwDatabaseError("Failed to check user show state.", userMediaError);
  }

  if (userMedia) {
    redirect(`/show/${mediaId}`);
  }
}

const loadTmdbShowDetail = cache((tmdbId: number) => getTmdbTvDetails(tmdbId));
const loadTmdbShowCredits = cache((tmdbId: number) => getTmdbTvAggregateCredits(tmdbId));

async function loadTmdbShowOrNotFound(tmdbId: number) {
  try {
    return await loadTmdbShowDetail(tmdbId);
  } catch (error) {
    if (isAppError(error) && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

async function loadTmdbShowCast(tmdbId: number) {
  try {
    return await loadTmdbShowCredits(tmdbId);
  } catch {
    return { id: tmdbId, cast: [], crew: [] };
  }
}

function normalizeTmdbId(value: string) {
  const tmdbId = Number(value);

  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    throw new AppError("Invalid TMDB show id.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return tmdbId;
}

function toDetailShow(detail: TmdbTvDetails) {
  const primaryGenre = detail.genres?.[0] ?? null;
  const firstAirDate = normalizeDate(detail.first_air_date);

  return {
    title: normalizeText(detail.name) ?? "Untitled show",
    poster_path: detail.poster_path ?? null,
    backdrop_path: detail.backdrop_path ?? null,
    first_air_date: firstAirDate,
    release_year: releaseYear(firstAirDate),
    original_language: normalizeText(detail.original_language),
    primary_genre_name: normalizeText(primaryGenre?.name),
    overview: normalizeText(detail.overview),
    runtime_minutes: detail.episode_run_time?.find((value) => value > 0) ?? null,
    tmdb_vote_average: oneDecimal(detail.vote_average),
    tmdb_vote_count: detail.vote_count ?? null,
    studio: normalizeText(detail.production_companies?.[0]?.name),
    network: normalizeText(detail.networks?.[0]?.name),
    season_count: detail.number_of_seasons ?? null,
    episode_count: detail.number_of_episodes ?? null,
    tags: [],
    seasons: [],
    userStatus: null,
    personalRating: null,
  };
}

function toShowCast(credits: TmdbTvAggregateCredits) {
  return (credits.cast ?? [])
    .slice()
    .sort((left, right) => (left.order ?? 9999) - (right.order ?? 9999))
    .slice(0, 12)
    .map((member) => ({
      id: member.id,
      tmdb_person_id: member.id,
      name: member.name,
      character_name: member.roles?.[0]?.character?.trim() || null,
      profile_path: member.profile_path ?? null,
    }));
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

function releaseYear(date: string | null) {
  if (!date) {
    return null;
  }

  const year = Number(date.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}
