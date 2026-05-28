import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { CollapsibleSeason } from "@/components/show/collapsible-season";
import {
  getTmdbRating,
  languageDisplayName,
  PersonalRating,
  TmdbRatingBadge,
} from "@/components/show/show-detail-view";
import type { Episode, MediaStatus, MediaWatchActivity, Tag } from "@/lib/db/types";
import { tmdbImage } from "@/lib/providers/tmdb/images";
import { countShowProgress } from "@/lib/show/progress";

type ShowEpisode = Episode & {
  watchActivity?: MediaWatchActivity[];
};

type ShowSeason = {
  seasonNumber: number;
  episodes: ShowEpisode[];
};

type EpisodeListShow = {
  id: string;
  title: string;
  poster_path: string | null;
  release_year: number | null;
  original_language: string | null;
  primary_genre_name: string | null;
  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
  tags?: Tag[];
  seasons: ShowSeason[];
  userStatus?: MediaStatus | null;
  personalRating?: number | null;
};

type ShowEpisodeListViewProps = {
  episodeWatchControl?: (episode: ShowEpisode) => ReactNode;
  ratingPicker?: ReactNode;
  seasonWatchControl?: (season: ShowSeason) => ReactNode;
  show: EpisodeListShow;
};

export function ShowEpisodeListView({
  episodeWatchControl,
  ratingPicker,
  seasonWatchControl,
  show,
}: ShowEpisodeListViewProps) {
  const { watched: watchedCount, total: totalCount } = countShowProgress(show.seasons);
  const tags = (show.tags ?? []).slice(0, 2);

  const status = show.userStatus ? effectiveStatus(show.userStatus, watchedCount, totalCount) : null;
  const headingLabel =
    totalCount === 0
      ? "Episodes"
      : status === "watched"
        ? "Watched"
        : status === "watching"
          ? "Watching"
          : "Episodes";
  const countLine =
    totalCount > 0 && watchedCount > 0 && watchedCount < totalCount
      ? `${watchedCount} of ${totalCount} episodes`
      : totalCount > 0
        ? `${totalCount} episodes`
        : null;
  const metaLine = [
    show.release_year,
    show.original_language ? languageDisplayName(show.original_language) : null,
    show.primary_genre_name,
  ]
    .filter(Boolean)
    .join(" · ");
  const tmdbRating = getTmdbRating(show);

  return (
    <main className="-mx-4 -mt-6 pb-4">
      <header
        className="sticky top-0 z-20 grid min-h-[78px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 border-b border-divider bg-background/90 px-4 pb-2 backdrop-blur"
        style={{ paddingTop: "calc(0.875rem + env(safe-area-inset-top))" }}
      >
        <BackButton className="-ml-1 flex h-11 items-center gap-0.5 text-foreground" />
        <h1 className="truncate text-center text-[21px] font-bold leading-[1.15]">{show.title}</h1>
        <Link
          className="inline-flex min-h-[42px] items-center rounded-full bg-accent/15 px-4 text-[15px] font-bold text-accent active:opacity-70"
          href={`/show/${show.id}`}
        >
          Show
        </Link>
      </header>

      <section className="grid grid-cols-[74px_minmax(0,1fr)] gap-3 border-b border-divider px-4 py-4">
        <ShowPosterSmall posterPath={show.poster_path} title={show.title} />
        <div className="min-w-0 self-center space-y-1">
          <p className="text-[18px] font-bold leading-[1.2]">{headingLabel}</p>
          {countLine ? (
            <p className="text-[13px] leading-[1.35] text-text-2">{countLine}</p>
          ) : null}
          {metaLine ? (
            <p className="text-[12px] leading-[1.35] text-text-muted">{metaLine}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            {ratingPicker ?? <PersonalRating rating={show.personalRating ?? null} />}
            {tmdbRating ? <TmdbRatingBadge rating={tmdbRating} /> : null}
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {tags.map((tag) => (
                <span
                  className="rounded-lg border border-accent/25 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
                  key={tag.id}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {show.seasons.length > 0 ? (
        <div>
          {show.seasons.map((season) => {
            const seasonWatched = season.episodes.filter(
              (ep) => (ep.watchActivity?.length ?? 0) > 0,
            ).length;
            return (
              <CollapsibleSeason
                defaultExpanded={season.seasonNumber === currentSeasonNumber(show.seasons)}
                episodeCount={season.episodes.length}
                key={season.seasonNumber}
                seasonNumber={season.seasonNumber}
                seasonWatchControl={seasonWatchControl?.(season)}
                watchedCount={seasonWatched}
              >
                {season.episodes.map((episode) => (
                  <EpisodeRow
                    episode={episode}
                    key={episode.id}
                    showId={show.id}
                    watchControl={episodeWatchControl?.(episode)}
                  />
                ))}
              </CollapsibleSeason>
            );
          })}
        </div>
      ) : (
        <p className="px-4 py-5 text-[15px] leading-[1.4] text-text-muted">
          No episode details available.
        </p>
      )}
    </main>
  );
}

function currentSeasonNumber(seasons: ShowSeason[]): number | null {
  // Last season with some (but not all) episodes watched
  let lastInProgress: number | null = null;
  for (const season of seasons) {
    const watched = season.episodes.filter((ep) => (ep.watchActivity?.length ?? 0) > 0).length;
    if (watched > 0 && watched < season.episodes.length) {
      lastInProgress = season.seasonNumber;
    }
  }
  if (lastInProgress !== null) return lastInProgress;

  // First season with any unwatched episodes
  for (const season of seasons) {
    if (season.episodes.some((ep) => (ep.watchActivity?.length ?? 0) === 0)) {
      return season.seasonNumber;
    }
  }

  // All watched: expand the last season
  if (seasons.length > 0) return seasons[seasons.length - 1].seasonNumber;

  return null;
}

function effectiveStatus(
  status: MediaStatus,
  watchedCount: number,
  totalCount: number,
): MediaStatus {
  if (totalCount > 0 && watchedCount >= totalCount) return "watched";
  return status;
}

function EpisodeRow({
  episode,
  showId,
  watchControl,
}: {
  episode: ShowEpisode;
  showId: string;
  watchControl?: ReactNode;
}) {
  const isWatched = (episode.watchActivity?.length ?? 0) > 0;
  const latestWatch = [...(episode.watchActivity ?? [])].sort(
    (left, right) => Date.parse(right.watched_at) - Date.parse(left.watched_at),
  )[0];
  const airDate = episode.air_date ? formatDateParts(episode.air_date) : null;

  return (
    <div className="grid min-h-[56px] grid-cols-[56px_minmax(0,1fr)_76px_44px] items-center gap-2.5 border-b border-divider px-4 py-1.5 last:border-b-0">
      <Link
        aria-label={`${episode.title} episode detail`}
        className="tabnum text-[13px] font-semibold leading-[1.2] text-text-2 active:opacity-70"
        href={`/show/${showId}/episode/${episode.id}`}
      >
        S{episode.season_number.toString().padStart(2, "0")}E
        {episode.episode_number.toString().padStart(2, "0")}
      </Link>
      <Link
        aria-label={`${episode.title} episode detail`}
        className="min-w-0 active:opacity-70"
        href={`/show/${showId}/episode/${episode.id}`}
      >
        <p className="truncate text-[15px] font-bold leading-[1.15] text-foreground">
          {episode.title}
        </p>
        {latestWatch ? (
          <p className="mt-0.5 text-[11px] leading-[1.2] text-watched">
            Watched {formatDate(latestWatch.watched_at.slice(0, 10))}
          </p>
        ) : null}
      </Link>
      <Link
        aria-hidden="true"
        className="tabnum text-center text-[12px] leading-[1.15] text-text-2 active:opacity-70"
        href={`/show/${showId}/episode/${episode.id}`}
        tabIndex={-1}
      >
        {airDate ? (
          <>
            {airDate.dayMonth}
            <br />
            {airDate.year}
          </>
        ) : null}
      </Link>
      <div className="justify-self-end">
        {watchControl ?? (
          <span
            aria-label={isWatched ? "Watched" : "Unwatched"}
            className={[
              "grid h-11 w-11 place-items-center rounded-full",
              isWatched ? "bg-accent text-black" : "bg-surface text-text-muted",
            ].join(" ")}
          >
            <Check aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
          </span>
        )}
      </div>
    </div>
  );
}

function formatDateParts(dateStr: string) {
  const label = formatDate(dateStr);
  const lastSpaceIndex = label.lastIndexOf(" ");

  if (lastSpaceIndex === -1) {
    return { dayMonth: label, year: "" };
  }

  return {
    dayMonth: label.slice(0, lastSpaceIndex),
    year: label.slice(lastSpaceIndex + 1),
  };
}

function ShowPosterSmall({
  posterPath,
  title,
}: {
  posterPath: string | null;
  title: string;
}) {
  return (
    <div className="flex aspect-[2/3] w-[74px] items-end overflow-hidden rounded-lg bg-surface-muted p-2 text-[10px] font-bold leading-[1.1] text-text-2 shadow-sm">
      {posterPath ? (
        <Image
          alt=""
          aria-hidden="true"
          className="-m-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] object-cover"
          {...tmdbImage(posterPath, "railPoster")}
        />
      ) : (
        title
      )}
    </div>
  );
}


function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
