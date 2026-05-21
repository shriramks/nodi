import Image from "next/image";
import { Film, UserRound } from "lucide-react";

import { CreditPosterCard } from "@/components/media/credit-poster-card";
import { TmdbImagePrefetcher } from "@/components/media/tmdb-image-prefetcher";
import { BackButton } from "@/components/navigation/back-button";
import { OverviewText } from "@/components/movie/overview-text";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { DetailBlock, DetailSourceList, type DetailSourceItem } from "@/components/ui/detail";
import { Section, SectionHeader, SectionScrollBleed } from "@/components/ui/section";
import { tmdbImage, tmdbImagePrefetchUrls } from "@/lib/providers/tmdb/images";

export type KnownForCredit = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseYear: number | null;
  role: string | null;
};

export type PersonDetail = {
  name: string;
  profilePath: string | null;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  birthplace: string | null;
  department: string | null;
  knownFor: KnownForCredit[];
  trivia: DetailSourceItem[];
};

type PersonDetailViewProps = {
  contextBackdropPath?: string | null;
  contextCharacter?: string | null;
  contextMovie?: string | null;
  person: PersonDetail;
};

export function PersonDetailView({
  contextBackdropPath,
  contextCharacter,
  contextMovie,
  person,
}: PersonDetailViewProps) {
  const heroBackdrop =
    contextBackdropPath ??
    person.knownFor.find((credit) => credit.backdropPath)?.backdropPath ??
    null;
  const roleLine =
    contextCharacter && contextMovie
      ? `as ${contextCharacter} in ${contextMovie}`
      : person.department
        ? `Known for ${person.department}`
        : null;
  const prefetchUrls = tmdbImagePrefetchUrls([
    ...person.knownFor.map((credit) => ({
      path: credit.posterPath,
      role: "railPoster" as const,
    })),
  ]);

  return (
    <main className="-mt-6 space-y-5 pb-4">
      <TmdbImagePrefetcher urls={prefetchUrls} />
      <section className="-mx-4">
        <div className="relative h-[244px] overflow-hidden bg-surface-muted">
          {heroBackdrop ? (
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              priority
              {...tmdbImage(heroBackdrop, "heroBackdrop")}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-muted">
              <Film aria-hidden="true" className="h-10 w-10 text-text-faint" strokeWidth={1.6} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-background" />
          <div
            className="absolute left-4 right-4 top-0 flex items-center justify-between"
            style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
          >
            <BackButton className="-ml-1 flex h-11 items-center gap-0.5 text-white drop-shadow-sm" />
            <SettingsSheet />
          </div>
        </div>
      </section>

      <section className="relative -mt-[74px] min-h-[142px]">
        <div className="absolute right-0 top-0 flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-[5px] border-background bg-surface-muted shadow-sm">
          {person.profilePath ? (
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover object-[center_25%]"
              priority
              {...tmdbImage(person.profilePath, "profilePortrait")}
            />
          ) : (
            <UserRound aria-hidden="true" className="h-12 w-12 text-text-faint" strokeWidth={1.6} />
          )}
        </div>

        <div className="max-w-[calc(100%-8.75rem)] pt-[72px]">
          <h1 className="text-[32px] font-bold leading-[1.1]">{person.name}</h1>
          {roleLine ? (
            <p className="mt-3 text-[17px] font-semibold leading-[1.35] text-text-2">
              {roleLine}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <DetailBlock label="Birthplace" value={person.birthplace} />
        <DetailBlock
          label={person.deathday ? "Born" : "Birthday"}
          value={formatLifeDate(person.birthday, person.deathday)}
        />
      </section>

      <Section>
        <SectionHeader>Biography</SectionHeader>
        <OverviewText text={person.biography} />
      </Section>

      <Section>
        <SectionHeader>Trivia</SectionHeader>
        <DetailSourceList
          emptyText="No source-backed trivia available."
          items={person.trivia}
        />
      </Section>

      <Section>
        <SectionHeader>Known For</SectionHeader>
        {person.knownFor.length > 0 ? (
          <SectionScrollBleed className="flex gap-3 pb-1">
            {person.knownFor.map((credit) => (
              <KnownForCard key={`${credit.mediaType}-${credit.id}`} credit={credit} />
            ))}
          </SectionScrollBleed>
        ) : (
          <p className="text-[15px] leading-[1.4] text-text-muted">
            No credits available.
          </p>
        )}
      </Section>
    </main>
  );
}

function KnownForCard({ credit }: { credit: KnownForCredit }) {
  return (
    <CreditPosterCard
      href={credit.mediaType === "movie" ? `/movie/tmdb/${credit.id}` : null}
      mediaType={credit.mediaType}
      posterPath={credit.posterPath}
      subtitle={[credit.releaseYear, credit.role].filter(Boolean).join(" · ")}
      title={credit.title}
    />
  );
}

function formatLifeDate(birthday: string | null, deathday: string | null) {
  if (!birthday) {
    return null;
  }

  const birthDate = parseTmdbDate(birthday);
  if (!birthDate) {
    return null;
  }

  const endDate = deathday ? parseTmdbDate(deathday) : new Date();
  const age = endDate ? ageAtDate(birthDate, endDate) : null;
  const dateLabel = formatDisplayDate(birthDate);

  if (deathday && endDate) {
    return age !== null
      ? `${dateLabel} - ${formatDisplayDate(endDate)} | ${age} years old`
      : `${dateLabel} - ${formatDisplayDate(endDate)}`;
  }

  return age !== null ? `${dateLabel} | ${age} years old` : dateLabel;
}

function parseTmdbDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function ageAtDate(birthDate: Date, endDate: Date) {
  let age = endDate.getFullYear() - birthDate.getFullYear();
  const hasHadBirthday =
    endDate.getMonth() > birthDate.getMonth() ||
    (endDate.getMonth() === birthDate.getMonth() && endDate.getDate() >= birthDate.getDate());

  if (!hasHadBirthday) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
