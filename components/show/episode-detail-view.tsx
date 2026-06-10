import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { CastMemberCard } from "@/components/media/cast-member-card";
import { OverviewText } from "@/components/movie/overview-text";
import { DetailRow } from "@/components/ui/detail";
import { Section, SectionHeader, SectionScrollBleed } from "@/components/ui/section";
import type { Episode, MediaItem, MediaWatchActivity, Tag, UserMedia } from "@/lib/db/types";
import { tmdbImage } from "@/lib/providers/tmdb/images";
import { formatDate, getTmdbRating } from "@/lib/media/format";

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
  watchHistory?: ReactNode;
};

export function EpisodeDetailView({
  actions,
  cast,
  episode,
  show,
  watchHistory,
}: EpisodeDetailViewProps) {
  const imagePath = episode.poster_path ?? episode.still_path ?? show.poster_path;
  const isWatched = (episode.watchActivity?.length ?? 0) > 0;
  const latestWatch = [...(episode.watchActivity ?? [])].sort(
    (left, right) => Date.parse(right.watched_at) - Date.parse(left.watched_at),
  )[0];
  const tmdbRating = getTmdbRating(show);
  const detailRows = [
    episode.air_date ? { label: "Airdate", value: formatDate(episode.air_date) } : null,
    episode.runtime_minutes ?? show.runtime_minutes
      ? { label: "Duration", value: `${episode.runtime_minutes ?? show.runtime_minutes} min` }
      : null,
    show.userMedia?.personal_rating
      ? { label: "Rating", value: String(show.userMedia.personal_rating) }
      : null,
    tmdbRating
      ? {
          label: "TMDB",
          value: tmdbRating.voteCount
            ? `${tmdbRating.value} · ${tmdbRating.voteCount.toLocaleString()} votes`
            : `${tmdbRating.value}`,
        }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

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

      <section className="grid grid-cols-[118px_minmax(0,1fr)] gap-4 border-b border-divider px-4 py-5">
        <div className="flex aspect-[2/3] w-[118px] items-center justify-center overflow-hidden rounded-[10px] bg-surface-muted shadow-sm">
          {imagePath ? (
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              priority
              {...tmdbImage(imagePath, "detailPoster")}
            />
          ) : (
            <Film aria-hidden="true" className="h-8 w-8 text-text-faint" strokeWidth={1.8} />
          )}
        </div>
        <div className="min-w-0 self-end">
          <p className="text-[13px] font-semibold leading-[1.3] text-text-2">{show.title}</p>
          <h1 className="mt-1 text-[29px] font-bold leading-[1.05]">{episode.title}</h1>
          <p className="tabnum mt-2 text-[14px] leading-[1.35] text-text-2">
            S{episode.season_number.toString().padStart(2, "0")}E
            {episode.episode_number.toString().padStart(2, "0")}
          </p>
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

        <Section className="border-b border-divider py-4">
          <SectionHeader>Details</SectionHeader>
          {detailRows.length > 0 ? (
            <div>
              {detailRows.map((row) => (
                <DetailRow divider={false} key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          ) : (
            <p className="text-[15px] leading-[1.4] text-text-muted">
              No extra details available.
            </p>
          )}
        </Section>

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

