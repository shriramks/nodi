import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Film, Star } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { CastMemberCard } from "@/components/media/cast-member-card";
import { OverviewText } from "@/components/movie/overview-text";
import { Section, SectionHeader, SectionScrollBleed } from "@/components/ui/section";
import type { Episode, MediaItem, MediaWatchActivity, Tag, UserMedia } from "@/lib/db/types";
import { tmdbImage } from "@/lib/providers/tmdb/images";
import { formatDate, type TmdbRating } from "@/lib/media/format";

type EpisodeDetailShow = MediaItem & {
  tags?: Tag[];
  userMedia?: UserMedia | null;
};

type DetailEpisode = Episode & {
  watchActivity?: MediaWatchActivity[];
};

type EpisodeCastMember = {
  character_name: string | null;
  id: string | number;
  name: string;
  profile_path: string | null;
  tmdb_person_id?: number | null;
};

type EpisodeDetailViewProps = {
  actions?: ReactNode;
  cast?: EpisodeCastMember[];
  episode: DetailEpisode;
  show: EpisodeDetailShow;
  tmdbRating?: TmdbRating | null;
  watchHistory?: ReactNode;
};

export function EpisodeDetailView({
  actions,
  cast,
  episode,
  show,
  tmdbRating,
  watchHistory,
}: EpisodeDetailViewProps) {
  // The episode still (16:9 frame) is the episode-specific image; poster_path
  // holds the season poster and is only a fallback.
  const stillPath = episode.still_path ?? episode.poster_path ?? show.poster_path;
  const isWatched = (episode.watchActivity?.length ?? 0) > 0;
  const latestWatch = [...(episode.watchActivity ?? [])].sort(
    (left, right) => Date.parse(right.watched_at) - Date.parse(left.watched_at),
  )[0];
  const runtimeMinutes = episode.runtime_minutes ?? show.runtime_minutes;
  const metaLine = [
    `S${episode.season_number.toString().padStart(2, "0")}E${episode.episode_number
      .toString()
      .padStart(2, "0")}`,
    runtimeMinutes ? `${runtimeMinutes} min` : null,
    episode.air_date ? formatDate(episode.air_date) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="-mx-4 -mt-6 pb-4">
      <header
        className="sticky top-0 z-20 flex min-h-[68px] items-center justify-between border-b border-divider bg-background/90 px-4 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <BackButton className="-ml-1 flex h-11 items-center gap-0.5 text-foreground" />
        <Link
          className="inline-flex min-h-10 items-center rounded-full bg-accent/15 px-4 text-[14px] font-bold text-accent active:opacity-70"
          href={`/show/${show.id}`}
        >
          Show
        </Link>
      </header>

      <section className="border-b border-divider">
        <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-surface-muted">
          {stillPath ? (
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              priority
              {...tmdbImage(stillPath, "heroBackdrop")}
            />
          ) : (
            <Film aria-hidden="true" className="h-9 w-9 text-text-faint" strokeWidth={1.8} />
          )}
        </div>
        <div className="px-4 py-4">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-[1.3] text-text-2">{show.title}</p>
              <h1 className="mt-1 text-[29px] font-bold leading-[1.05]">{episode.title}</h1>
            </div>
            {tmdbRating ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent/15 px-2.5 py-1.5">
                <Star aria-hidden="true" className="h-3.5 w-3.5 fill-accent text-accent" strokeWidth={0} />
                <span className="tabnum text-[17px] font-bold leading-none text-foreground">
                  {tmdbRating.value}
                </span>
              </span>
            ) : null}
          </div>
          <p className="tabnum mt-2.5 text-[14px] leading-[1.35] text-text-2">{metaLine}</p>
          {latestWatch ? (
            <p className="mt-2 text-[13px] font-semibold text-watched">
              Watched {formatDate(latestWatch.watched_at.slice(0, 10))}
            </p>
          ) : isWatched ? (
            <p className="mt-2 text-[13px] font-semibold text-watched">Watched</p>
          ) : null}
        </div>
      </section>

      {actions}
      {watchHistory}

      <div className="px-4">
        <Section className="border-b border-divider py-4">
          <SectionHeader>Plot</SectionHeader>
          <OverviewText text={episode.overview} />
        </Section>

        {(cast?.length ?? 0) > 0 ? (
          <Section className="border-b border-divider py-4">
            <SectionHeader>Cast</SectionHeader>
            <SectionScrollBleed className="flex gap-3 pb-1">
              {(cast ?? []).map((member) => (
                <CastMemberCard
                  key={member.id}
                  characterName={member.character_name}
                  name={member.name}
                  personHref={
                    member.tmdb_person_id ? `/person/tmdb/${member.tmdb_person_id}` : undefined
                  }
                  profilePath={member.profile_path}
                />
              ))}
            </SectionScrollBleed>
          </Section>
        ) : null}

        {(show.tags?.length ?? 0) > 0 ? (
          <Section className="py-4">
            <SectionHeader>Show tags</SectionHeader>
            <div className="flex flex-wrap gap-2">
              {(show.tags ?? []).map((tag) => (
                <span
                  className="inline-flex min-h-[30px] items-center rounded-lg bg-surface px-2.5 text-[12px] font-semibold text-text-2"
                  key={tag.id}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  );
}

