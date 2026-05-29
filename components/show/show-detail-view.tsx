import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { OverviewText } from "@/components/movie/overview-text";
import { DetailRow } from "@/components/ui/detail";
import {
  CollapsibleSection,
  Section,
  SectionHeader,
  SectionScrollBleed,
} from "@/components/ui/section";
import {
  MediaInfoPanel,
  PersonalRating,
  TmdbRatingBadge,
} from "@/components/media/media-info-panel";
import type { Episode, MediaStatus, MediaWatchActivity, Tag } from "@/lib/db/types";
import { tmdbImage } from "@/lib/providers/tmdb/images";
import { countShowProgress } from "@/lib/show/progress";
import { formatDate, getTmdbRating, languageDisplayName } from "@/lib/media/format";

type ShowEpisode = Episode & {
  watchActivity?: MediaWatchActivity[];
};

type ShowSeason = {
  seasonNumber: number;
  episodes: ShowEpisode[];
};

type DetailShow = {
  id?: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  release_year: number | null;
  original_language: string | null;
  primary_genre_name: string | null;
  overview: string | null;
  runtime_minutes: number | null;
  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
  studio: string | null;
  network: string | null;
  season_count: number | null;
  episode_count: number | null;
  cast?: ShowCastMember[];
  tags?: Tag[];
  seasons?: ShowSeason[];
  userStatus?: MediaStatus | null;
  personalRating?: number | null;
};

type ShowCastMember = {
  character_name: string | null;
  id: string | number;
  name: string;
  profile_path: string | null;
  tmdb_person_id?: number | null;
};

type ShowDetailViewProps = {
  actions?: ReactNode;
  ratingPicker?: ReactNode;
  show: DetailShow;
  tagEditor?: ReactNode;
};

export function ShowDetailView({
  actions,
  ratingPicker,
  show,
  tagEditor,
}: ShowDetailViewProps) {
  const tmdbRating = getTmdbRating(show);
  const statusLabel = showStatusLine(show);
  const resolvedStatus = resolveShowStatus(show);
  const statusColour = resolvedStatus ? statusColourFor(resolvedStatus) : null;
  const detailRows = [
    show.first_air_date ? { label: "First aired", value: formatDate(show.first_air_date) } : null,
    show.network ? { label: "Network", value: show.network } : null,
    show.season_count !== null ? { label: "Seasons", value: String(show.season_count) } : null,
    show.episode_count !== null ? { label: "Episodes", value: String(show.episode_count) } : null,
    show.runtime_minutes ? { label: "Episode runtime", value: `${show.runtime_minutes} min` } : null,
    show.original_language
      ? { label: "Language", value: languageDisplayName(show.original_language) }
      : null,
    tmdbRating
      ? {
          label: "TMDB rating",
          value: tmdbRating.voteCount
            ? `${tmdbRating.value} · ${tmdbRating.voteCount.toLocaleString()} votes`
            : `${tmdbRating.value}`,
        }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <main className="-mt-6 space-y-4 pb-4">
      <section className="-mx-4">
        <div className="relative h-[244px] overflow-hidden bg-surface-muted">
          {show.backdrop_path ? (
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              priority
              {...tmdbImage(show.backdrop_path, "heroBackdrop")}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-muted">
              <Film aria-hidden="true" className="h-10 w-10 text-text-faint" strokeWidth={1.6} />
            </div>
          )}
          <div className="movie-detail-hero-scrim absolute inset-0" />
          <div className="movie-detail-title-vignette absolute inset-0" />
          <div
            className="absolute left-4 right-4 top-0 flex items-center justify-between"
            style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
          >
            <BackButton className="-ml-1 flex h-11 items-center gap-0.5 text-white drop-shadow-sm" />
            <SettingsSheet />
          </div>
        </div>
      </section>

      <MediaInfoPanel
        className="relative -mt-[92px] min-h-[194px]"
        title={show.title}
        posterPath={show.poster_path}
        releaseYear={show.release_year}
        originalLanguage={show.original_language}
        primaryGenreName={show.primary_genre_name}
        tmdbVoteAverage={show.tmdb_vote_average}
        tmdbVoteCount={show.tmdb_vote_count}
        tags={show.tags}
        personalRating={show.personalRating}
        ratingPicker={ratingPicker}
        statusLabel={statusLabel}
        statusClassName={statusColour}
        showDoneIcon={resolvedStatus === "done"}
      />

      {actions || show.id ? (
        <div className="space-y-2">
          {show.id ? (
            <Link
              className="flex h-11 w-full items-center justify-center rounded-xl bg-surface px-4 text-[14px] font-bold text-foreground active:opacity-70"
              href={`/show/${show.id}/episodes`}
            >
              Episodes
            </Link>
          ) : null}
          {actions}
        </div>
      ) : null}

      <Section>
        <SectionHeader>Plot</SectionHeader>
        <OverviewText text={show.overview} />
      </Section>

      <Section>
        <SectionHeader>Cast</SectionHeader>
        {(show.cast?.length ?? 0) > 0 ? (
          <SectionScrollBleed className="flex gap-3 pb-1">
            {(show.cast ?? []).map((member) => (
              <ShowCastMemberLink key={member.id} member={member} />
            ))}
          </SectionScrollBleed>
        ) : (
          <p className="text-[15px] leading-[1.4] text-text-muted">
            No cast details available.
          </p>
        )}
      </Section>

      {show.userStatus ? tagEditor : null}

      <CollapsibleSection title="Details">
        {detailRows.length > 0 ? (
          <div>
            {detailRows.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} divider={false} />
            ))}
          </div>
        ) : (
          <p className="text-[15px] leading-[1.4] text-text-muted">
            No extra details available.
          </p>
        )}
      </CollapsibleSection>
    </main>
  );
}

function ShowCastMemberLink({ member }: { member: ShowCastMember }) {
  const content = (
    <div className="w-[72px] shrink-0">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-surface-muted">
        {member.profile_path ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            {...tmdbImage(member.profile_path, "profileAvatar")}
          />
        ) : (
          <Film aria-hidden="true" className="h-5 w-5 text-text-faint" strokeWidth={1.7} />
        )}
      </div>
      <p className="mt-1.5 truncate text-[12px] font-semibold leading-[1.2] text-foreground">
        {member.name}
      </p>
      {member.character_name ? (
        <p className="mt-0.5 truncate text-[11px] text-text-muted">{member.character_name}</p>
      ) : null}
    </div>
  );

  if (!member.tmdb_person_id) {
    return content;
  }

  return (
    <Link className="active:opacity-70" href={`/person/tmdb/${member.tmdb_person_id}`}>
      {content}
    </Link>
  );
}

export { MediaInfoPanel as ShowInfoPanel, PersonalRating, TmdbRatingBadge };

function showStatusLine(show: DetailShow) {
  const resolvedStatus = resolveShowStatus(show);
  if (!resolvedStatus) {
    return null;
  }

  const { watched: watchedCount, total: totalCount } = countShowProgress(show.seasons ?? []);

  const base = statusLabelFor(resolvedStatus);

  if (totalCount > 0) {
    return `${base} · ${watchedCount}/${totalCount} episodes`;
  }

  return base;
}

function resolveShowStatus(show: DetailShow): MediaStatus | null {
  return show.userStatus ?? null;
}

function statusLabelFor(status: MediaStatus) {
  if (status === "wishlist") return "Wishlist";
  if (status === "done") return "Done";
  if (status === "stopped") return "Stopped";
  return "Watching";
}

function statusColourFor(status: MediaStatus) {
  if (status === "wishlist") return "text-watchlist";
  if (status === "done") return "text-watched";
  if (status === "stopped") return "text-text-muted";
  return "text-accent";
}

