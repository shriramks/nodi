import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Heart } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import type { Episode, MediaStatus, MediaWatchActivity, Tag } from "@/lib/db/types";
import { tmdbImage } from "@/lib/providers/tmdb/images";

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
  show: EpisodeListShow;
};

export function ShowEpisodeListView({
  episodeWatchControl,
  show,
}: ShowEpisodeListViewProps) {
  const watchedCount = show.seasons.reduce(
    (count, season) =>
      count + season.episodes.filter((episode) => (episode.watchActivity?.length ?? 0) > 0).length,
    0,
  );
  const totalCount = show.seasons.reduce((count, season) => count + season.episodes.length, 0);
  const tags = (show.tags ?? []).slice(0, 2);
  const metaLine = [
    show.primary_genre_name,
    show.original_language ? languageDisplayName(show.original_language) : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
        <div className="min-w-0 self-center">
          <p className="text-[18px] font-bold leading-[1.2]">
            {totalCount > 0
              ? `Watched · ${watchedCount}/${totalCount} episodes`
              : "Episodes"}
          </p>
          {metaLine ? <p className="mt-1 text-[13px] leading-[1.35] text-text-2">{metaLine}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {show.personalRating !== null && show.personalRating !== undefined ? (
              <span className="inline-flex min-h-7 items-center gap-1 rounded-lg bg-accent/15 px-2 text-[12px] font-bold text-accent">
                <Heart aria-hidden="true" className="h-3.5 w-3.5 fill-accent/20" strokeWidth={1.8} />
                {show.personalRating}
              </span>
            ) : null}
            {show.tmdb_vote_average !== null && show.tmdb_vote_average !== undefined ? (
              <span className="inline-flex min-h-7 items-center rounded-lg bg-surface px-2 text-[12px] font-bold text-text-2">
                <strong className="mr-1 text-[10px] text-tmdb-brand">TMDB</strong>
                {show.tmdb_vote_average}
                {show.tmdb_vote_count ? ` · ${compactNumber(show.tmdb_vote_count)}` : null}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {show.userStatus ? (
              <span className="inline-flex min-h-7 items-center rounded-lg bg-watched/15 px-2 text-[12px] font-semibold text-watched">
                {statusLabelFor(show.userStatus)}
              </span>
            ) : null}
            {tags.map((tag) => (
              <span
                className="inline-flex min-h-7 items-center rounded-lg bg-surface px-2 text-[12px] font-semibold text-text-2"
                key={tag.id}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {show.seasons.length > 0 ? (
        <div>
          {show.seasons.map((season) => (
            <article className="border-b border-divider" key={season.seasonNumber}>
              <div className="sticky top-[78px] z-10 flex min-h-11 items-center justify-between gap-3 border-b border-divider bg-background/95 px-4 backdrop-blur">
                <h2 className="text-[18px] font-bold text-text-muted">
                  {season.seasonNumber === 0 ? "Specials" : `Season ${season.seasonNumber}`}
                </h2>
                <span className="tabnum text-[13px] text-text-muted">
                  {season.episodes.length} episodes
                </span>
              </div>
              <div>
                {season.episodes.map((episode) => (
                  <EpisodeRow
                    episode={episode}
                    key={episode.id}
                    showId={show.id}
                    watchControl={episodeWatchControl?.(episode)}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="px-4 py-5 text-[15px] leading-[1.4] text-text-muted">
          No episode details available.
        </p>
      )}
    </main>
  );
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

  return (
    <div className="grid min-h-[88px] grid-cols-[minmax(0,1fr)_48px] items-center gap-3 border-b border-divider px-4 py-3 last:border-b-0">
      <Link
        aria-label={`${episode.title} episode detail`}
        className="min-w-0 active:opacity-70"
        href={`/show/${showId}/episode/${episode.id}`}
      >
        <p className="truncate text-[20px] font-bold leading-[1.15] text-foreground">
          {episode.title}
        </p>
        <p className="mt-1 text-[14px] leading-[1.3] text-text-2">
          <span className="tabnum">
            S{episode.season_number.toString().padStart(2, "0")}E
            {episode.episode_number.toString().padStart(2, "0")}
          </span>
          {episode.air_date ? ` · ${formatDate(episode.air_date)}` : null}
        </p>
        {latestWatch ? (
          <p className="mt-1 text-[13px] leading-[1.3] text-watched">
            Watched {formatDate(latestWatch.watched_at.slice(0, 10))}
          </p>
        ) : null}
      </Link>
      {watchControl ?? (
        <span
          aria-label={isWatched ? "Watched" : "Unwatched"}
          className={[
            "grid h-12 w-12 place-items-center rounded-full",
            isWatched ? "bg-accent text-black" : "bg-surface text-text-muted",
          ].join(" ")}
        >
          <Check aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
        </span>
      )}
    </div>
  );
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

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function statusLabelFor(status: MediaStatus) {
  if (status === "wishlist") {
    return "Wishlist";
  }

  if (status === "watched") {
    return "Watched show";
  }

  return "Watching";
}

function languageDisplayName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
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
