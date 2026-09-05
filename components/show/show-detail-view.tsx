import type { ReactNode } from "react";

import { DetailHeroSection } from "@/components/media/detail-hero-section";
import { CastMemberCard } from "@/components/media/cast-member-card";
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
import {
  AutoSyncFailedNotice,
  EpisodesRow,
  type RefreshResult,
} from "@/components/show/show-state-actions";
import type { Episode, MediaStatus, MediaWatchActivity, Tag } from "@/lib/db/types";
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
  cast?: { character_name: string | null; id: string | number; name: string; profile_path: string | null; tmdb_person_id?: number | null }[];
  tags?: Tag[];
  seasons?: ShowSeason[];
  userStatus?: MediaStatus | null;
  personalRating?: number | null;
};

type ShowDetailViewProps = {
  actions?: ReactNode;
  autoSyncFailed?: boolean;
  ratingPicker?: ReactNode;
  refreshFromTmdb?: () => Promise<RefreshResult>;
  show: DetailShow;
  tagEditor?: ReactNode;
};

export function ShowDetailView({
  actions,
  autoSyncFailed,
  ratingPicker,
  refreshFromTmdb,
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
      <DetailHeroSection backdropPath={show.backdrop_path} />

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
          {autoSyncFailed && refreshFromTmdb ? (
            <AutoSyncFailedNotice refreshFromTmdb={refreshFromTmdb} />
          ) : null}
          {show.id ? <EpisodesRow refreshFromTmdb={refreshFromTmdb} showId={show.id} /> : null}
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
              <CastMemberCard
                key={member.id}
                characterName={member.character_name}
                name={member.name}
                personHref={member.tmdb_person_id ? `/person/tmdb/${member.tmdb_person_id}` : undefined}
                profilePath={member.profile_path}
              />
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

