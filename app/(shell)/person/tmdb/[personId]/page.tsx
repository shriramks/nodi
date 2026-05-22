import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PersonDetailView,
  type PersonDetail,
} from "@/components/person/person-detail-view";
import { AppError, isAppError } from "@/lib/errors";
import {
  getTmdbPersonCombinedCreditsWithAuth,
  getTmdbPersonDetails,
  getTmdbPersonDetailsWithAuth,
  loadTmdbAuthForCurrentUser,
  type TmdbAuth,
  type TmdbPersonCombinedCredits,
  type TmdbPersonDetails,
} from "@/lib/providers/tmdb/client";
import { toRelevantPersonMovies } from "@/lib/providers/tmdb/person-credits";

type PersonDetailPageProps = {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{
    backdrop?: string;
    character?: string;
    movie?: string;
    sourceMovieId?: string;
  }>;
};

export async function generateMetadata({
  params,
}: PersonDetailPageProps): Promise<Metadata> {
  try {
    const { personId: rawPersonId } = await params;
    const personId = normalizePersonId(rawPersonId);
    const detail = await getTmdbPersonDetails(personId);
    return { title: detail.name };
  } catch {
    return { title: "Cast Member" };
  }
}

export default async function TmdbPersonDetailPage({
  params,
  searchParams,
}: PersonDetailPageProps) {
  const [{ personId: rawPersonId }, query] = await Promise.all([params, searchParams]);
  const personId = normalizePersonId(rawPersonId);
  const auth = await loadTmdbAuthForCurrentUser();
  const [detail, credits] = await loadTmdbPersonOrNotFound(personId, auth);

  return (
    <PersonDetailView
      contextBackdropPath={normalizeBackdropPath(query.backdrop)}
      contextCharacter={normalizeQueryText(query.character)}
      contextMovie={normalizeQueryText(query.movie)}
      person={toPersonDetail(
        detail,
        credits,
        normalizePositiveInt(query.sourceMovieId),
      )}
    />
  );
}

async function loadTmdbPersonOrNotFound(personId: number, auth: TmdbAuth) {
  try {
    return await Promise.all([
      getTmdbPersonDetailsWithAuth(auth, personId),
      getTmdbPersonCombinedCreditsWithAuth(auth, personId),
    ]);
  } catch (error) {
    if (isAppError(error) && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

function normalizePersonId(value: string) {
  const personId = Number(value);

  if (!Number.isInteger(personId) || personId < 1) {
    throw new AppError("Invalid TMDB person id.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return personId;
}

function toPersonDetail(
  detail: TmdbPersonDetails,
  credits: TmdbPersonCombinedCredits,
  sourceMovieId: number | null,
): PersonDetail {
  const knownFor = toRelevantPersonMovies(credits, { sourceMovieId });

  return {
    name: normalizeText(detail.name) ?? "Unknown",
    profilePath: detail.profile_path ?? null,
    biography: normalizeText(detail.biography),
    birthday: normalizeDate(detail.birthday),
    deathday: normalizeDate(detail.deathday),
    birthplace: normalizeText(detail.place_of_birth),
    department: normalizeText(detail.known_for_department),
    knownFor,
  };
}

function normalizeDate(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeQueryText(value: string | undefined) {
  const normalized = normalizeText(value);
  return normalized ? normalized.slice(0, 140) : null;
}

function normalizePositiveInt(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeBackdropPath(value: string | undefined) {
  const normalized = normalizeText(value);
  return normalized && /^\/[A-Za-z0-9_.-]+\.(jpg|png|webp)$/.test(normalized)
    ? normalized
    : null;
}
