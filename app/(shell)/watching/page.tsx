import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Film } from "lucide-react";

import { InsightRow, InsightRows } from "@/components/ui/insight-row";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { PageHeader, Section, SectionHeader } from "@/components/ui/section";
import { getCompanionTagName, getWatchingPageData } from "@/lib/db/queries";
import type { CompanionMonth, WatchingShow } from "@/lib/db/types";
import { companionLabel, formatPercent, formatRuntime, signedRuntime } from "@/lib/media/format";
import { tmdbImage } from "@/lib/providers/tmdb/images";

export const metadata: Metadata = {
  title: "Now Watching",
};

// Hero plus two rows; older in-progress shows live in the Library.
const maxShows = 3;

export default async function WatchingPage() {
  const { shows, companionMonth } = await getWatchingPageData();
  const companion = companionLabel(getCompanionTagName());
  const [hero, ...others] = shows.slice(0, maxShows);

  return (
    <main>
      <PageHeader title="Now Watching" className="pb-3" action={<SettingsSheet />} />

      {hero ? (
        <>
          <Section className="pb-5">
            <SectionHeader>Continue</SectionHeader>
            <HeroCard show={hero} />
          </Section>

          {others.length > 0 && (
            <Section className="pb-5">
              <SectionHeader>Shows in progress</SectionHeader>
              <div>
                {others.map((show) => (
                  <ShowRow key={show.id} show={show} />
                ))}
              </div>
            </Section>
          )}
        </>
      ) : (
        <p className="pb-5 text-[15px] leading-[1.4] text-text-2">
          No shows in progress. Start a show and it will show up here.
        </p>
      )}

      <div className="h-px bg-divider" />
      <Section className="py-4">
        <SectionHeader>Last month with {companion}</SectionHeader>
        <CompanionMonthRows month={companionMonth} companion={companion} />
      </Section>
    </main>
  );
}

function episodeLabel(show: WatchingShow) {
  const next = show.nextEpisode;
  if (!next) return "Waiting for new episodes";
  return `S${next.seasonNumber} · E${next.episodeNumber} — ${next.title}`;
}

function progressPercent(show: WatchingShow) {
  if (show.totalEpisodeCount === 0) return 0;
  return Math.min(100, Math.round((show.watchedEpisodeCount / show.totalEpisodeCount) * 100));
}

function HeroCard({ show }: { show: WatchingShow }) {
  const href = show.nextEpisode ? `/show/${show.id}/episode/${show.nextEpisode.id}` : `/show/${show.id}/episodes`;

  return (
    <Link href={href} className="block overflow-hidden rounded-2xl bg-surface">
      <div className="relative h-[150px] bg-surface-muted">
        {show.backdropPath ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            {...tmdbImage(show.backdropPath, "heroBackdrop")}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Film aria-hidden="true" className="h-8 w-8 text-text-faint" strokeWidth={1.6} />
          </div>
        )}
      </div>
      <div className="p-3.5">
        <p className="truncate text-[18px] font-bold leading-[1.2]">{show.title}</p>
        <p className="mb-2.5 mt-0.5 truncate text-[13px] text-text-2">{episodeLabel(show)}</p>
        <ProgressBar percent={progressPercent(show)} />
      </div>
    </Link>
  );
}

function ShowRow({ show }: { show: WatchingShow }) {
  return (
    <Link href={`/show/${show.id}/episodes`} className="flex min-h-12 items-center gap-3 py-2">
      <div className="relative flex h-[54px] w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-muted">
        {show.posterPath ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            {...tmdbImage(show.posterPath, "gridPoster")}
          />
        ) : (
          <Film aria-hidden="true" className="h-4 w-4 text-text-faint" strokeWidth={1.8} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{show.title}</p>
        <p className="tabnum mt-0.5 truncate text-[12px] text-text-2">
          {show.watchedEpisodeCount} of {show.totalEpisodeCount} episodes
        </p>
        <ProgressBar percent={progressPercent(show)} className="mt-1.5 w-[60px]" />
      </div>
    </Link>
  );
}

function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-divider ${className}`}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}

function CompanionMonthRows({ month, companion }: { month: CompanionMonth; companion: string }) {
  const { withCompanion, withCompanionPreviousMonth } = month;

  if (withCompanion.titleCount === 0) {
    return (
      <p className="text-[15px] leading-[1.4] text-text-muted">
        Nothing watched with {companion} in {month.label}.
      </p>
    );
  }

  return (
    <InsightRows>
      <InsightRow
        value={formatRuntime(withCompanion.runtimeMinutes)}
        description="time together"
      />
      <InsightRow
        value={signedRuntime(withCompanion.runtimeMinutes - withCompanionPreviousMonth.runtimeMinutes)}
        description={`vs ${month.previousMonthLabel}`}
      />
      <InsightRow value={formatPercent(month.sharePercent)} description="of everything you watched" />
      {month.highestRated && <InsightRow value={month.highestRated.title} description={`highest-rated together, ${month.highestRated.rating}`} />}
      {month.topWeekday && <InsightRow value={month.topWeekday} description="day you watch together most" />}
    </InsightRows>
  );
}
