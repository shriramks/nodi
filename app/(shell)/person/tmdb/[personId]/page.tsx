import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PersonDetailView,
  type KnownForCredit,
  type PersonDetail,
} from "@/components/person/person-detail-view";
import type { DetailSourceItem } from "@/components/ui/detail";
import { AppError, isAppError } from "@/lib/errors";
import {
  getTmdbPersonCombinedCredits,
  getTmdbPersonDetails,
  type TmdbPersonCombinedCredits,
  type TmdbPersonCredit,
  type TmdbPersonDetails,
} from "@/lib/providers/tmdb/client";
import { getPersonWikipediaTrivia } from "@/lib/providers/wikipedia/trivia";

type PersonDetailPageProps = {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{
    backdrop?: string;
    character?: string;
    movie?: string;
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
  const [detail, credits] = await loadTmdbPersonOrNotFound(personId);
  const trivia = await getPersonWikipediaTrivia({
    birthday: normalizeDate(detail.birthday),
    imdbId: detail.imdb_id,
    name: normalizeText(detail.name) ?? "Unknown",
    tmdbPersonId: detail.id,
  });

  return (
    <PersonDetailView
      contextBackdropPath={normalizeBackdropPath(query.backdrop)}
      contextCharacter={normalizeQueryText(query.character)}
      contextMovie={normalizeQueryText(query.movie)}
      person={toPersonDetail(detail, credits, trivia)}
    />
  );
}

async function loadTmdbPersonOrNotFound(personId: number) {
  try {
    return await Promise.all([
      getTmdbPersonDetails(personId),
      getTmdbPersonCombinedCredits(personId),
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
  trivia: DetailSourceItem[],
): PersonDetail {
  const knownFor = toKnownForCredits(credits);

  return {
    name: normalizeText(detail.name) ?? "Unknown",
    profilePath: detail.profile_path ?? null,
    biography: normalizeText(detail.biography),
    birthday: normalizeDate(detail.birthday),
    deathday: normalizeDate(detail.deathday),
    birthplace: normalizeText(detail.place_of_birth),
    department: normalizeText(detail.known_for_department),
    knownFor,
    trivia,
  };
}

function toKnownForCredits(credits: TmdbPersonCombinedCredits): KnownForCredit[] {
  const merged = [...(credits.cast ?? []), ...(credits.crew ?? [])]
    .filter((credit) => credit.id > 0 && (credit.media_type === "movie" || credit.media_type === "tv"))
    .map(toKnownForCredit)
    .filter((credit): credit is KnownForCreditWithScore => credit !== null);
  const byCredit = new Map<string, KnownForCreditWithScore>();

  for (const credit of merged) {
    const key = `${credit.mediaType}-${credit.id}`;
    const existing = byCredit.get(key);

    if (!existing || credit.score > existing.score) {
      byCredit.set(key, credit);
    }
  }

  return Array.from(byCredit.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
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

type KnownForCreditWithScore = KnownForCredit & {
  score: number;
};

function toKnownForCredit(credit: TmdbPersonCredit): KnownForCreditWithScore | null {
  const mediaType = credit.media_type === "tv" ? "tv" : credit.media_type === "movie" ? "movie" : null;
  if (!mediaType) {
    return null;
  }

  const title = normalizeText(mediaType === "movie" ? credit.title : credit.name);
  if (!title) {
    return null;
  }

  const date = mediaType === "movie" ? credit.release_date : credit.first_air_date;
  const role = normalizeText(credit.character) ?? normalizeText(credit.job);

  return {
    id: credit.id,
    mediaType,
    title,
    posterPath: credit.poster_path ?? null,
    backdropPath: credit.backdrop_path ?? null,
    releaseYear: releaseYear(normalizeDate(date)),
    role,
    score: knownForScore(credit),
  };
}

function knownForScore(credit: TmdbPersonCredit) {
  const popularity = typeof credit.popularity === "number" ? credit.popularity : 0;
  const votes = typeof credit.vote_count === "number" ? Math.min(credit.vote_count, 5000) / 400 : 0;
  const posterBonus = credit.poster_path ? 8 : 0;
  const backdropBonus = credit.backdrop_path ? 4 : 0;

  return popularity + votes + posterBonus + backdropBonus;
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

function normalizeBackdropPath(value: string | undefined) {
  const normalized = normalizeText(value);
  return normalized && /^\/[A-Za-z0-9_.-]+\.(jpg|png|webp)$/.test(normalized)
    ? normalized
    : null;
}

function releaseYear(releaseDate: string | null) {
  if (!releaseDate) {
    return null;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}
