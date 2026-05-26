import type { ReactNode } from "react";
import Image from "next/image";
import { Film, Heart, Tv } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { OverviewText } from "@/components/movie/overview-text";
import { DetailRow } from "@/components/ui/detail";
import {
  CollapsibleSection,
  Section,
  SectionHeader,
} from "@/components/ui/section";
import type { Episode, MediaStatus, Tag } from "@/lib/db/types";
import { tmdbImage } from "@/lib/providers/tmdb/images";

type ShowSeason = {
  seasonNumber: number;
  episodes: Episode[];
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
  tags?: Tag[];
  seasons?: ShowSeason[];
  userStatus?: MediaStatus | null;
  personalRating?: number | null;
};

type ShowDetailViewProps = {
  actions?: ReactNode;
  show: DetailShow;
};

export function ShowDetailView({ actions, show }: ShowDetailViewProps) {
  const metaLine = [
    show.release_year,
    show.original_language ? languageDisplayName(show.original_language) : null,
    show.primary_genre_name,
  ]
    .filter(Boolean)
    .join(" · ");
  const visibleTags = (show.tags ?? []).slice(0, 3);
  const tmdbRating = getTmdbRating(show);
  const statusLabel = show.userStatus ? statusLabelFor(show.userStatus) : null;
  const detailRows = [
    show.first_air_date ? { label: "First aired", value: formatDate(show.first_air_date) } : null,
    show.studio ? { label: "Studio", value: show.studio } : null,
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
              <Tv aria-hidden="true" className="h-10 w-10 text-text-faint" strokeWidth={1.6} />
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

      <section className="relative -mt-[92px] flex min-h-[194px] items-start gap-4">
        <div className="flex aspect-[2/3] w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[5px] border-background bg-surface-muted shadow-sm">
          {show.poster_path ? (
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              priority
              {...tmdbImage(show.poster_path, "detailPoster")}
            />
          ) : (
            <Film aria-hidden="true" className="h-8 w-8 text-text-faint" strokeWidth={1.8} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5 pt-1">
          <h1 className="text-[22px] font-bold leading-[1.2]">{show.title}</h1>

          {metaLine ? <p className="text-[13px] leading-[1.35] text-text-2">{metaLine}</p> : null}

          {statusLabel ? (
            <p className="text-[15px] font-semibold text-accent">{statusLabel}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <PersonalRating rating={show.personalRating ?? null} />
            {tmdbRating ? <TmdbRatingBadge rating={tmdbRating} /> : null}
          </div>

          {visibleTags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {visibleTags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-lg border border-accent/25 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
                >
                  {tag.name}
                </span>
              ))}
              {(show.tags?.length ?? 0) > 3 ? (
                <span className="rounded-lg border border-border px-2 py-0.5 text-[11px] text-text-faint">
                  +{(show.tags?.length ?? 0) - 3}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {actions}

      <Section>
        <SectionHeader>Plot</SectionHeader>
        <OverviewText text={show.overview} />
      </Section>

      <ShowSeasonList seasons={show.seasons ?? []} expectedEpisodeCount={show.episode_count} />

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

function ShowSeasonList({
  expectedEpisodeCount,
  seasons,
}: {
  expectedEpisodeCount: number | null;
  seasons: ShowSeason[];
}) {
  if (seasons.length === 0) {
    return (
      <Section>
        <SectionHeader>Seasons</SectionHeader>
        <p className="text-[15px] leading-[1.4] text-text-muted">
          {expectedEpisodeCount
            ? `${expectedEpisodeCount} episodes listed by TMDB.`
            : "No episode details available."}
        </p>
      </Section>
    );
  }

  return (
    <Section>
      <SectionHeader>Seasons</SectionHeader>
      <div className="space-y-3">
        {seasons.map((season) => (
          <article key={season.seasonNumber} className="space-y-2">
            <div className="flex min-h-8 items-center justify-between gap-3 border-b border-divider pb-1">
              <h2 className="text-[15px] font-semibold text-foreground">
                {season.seasonNumber === 0 ? "Specials" : `Season ${season.seasonNumber}`}
              </h2>
              <span className="tabnum text-[13px] text-text-muted">
                {season.episodes.length} episodes
              </span>
            </div>
            <div className="space-y-1">
              {season.episodes.slice(0, 6).map((episode) => (
                <div
                  key={episode.id}
                  className="grid min-h-10 grid-cols-[34px_1fr] items-center gap-3"
                >
                  <span className="tabnum text-[13px] font-semibold text-text-faint">
                    E{episode.episode_number}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-foreground">
                      {episode.title}
                    </p>
                    {episode.air_date ? (
                      <p className="text-[12px] text-text-muted">{formatDate(episode.air_date)}</p>
                    ) : null}
                  </div>
                </div>
              ))}
              {season.episodes.length > 6 ? (
                <p className="tabnum pl-[46px] text-[12px] text-text-muted">
                  +{season.episodes.length - 6} more
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function PersonalRating({ rating }: { rating: number | null }) {
  return (
    <span
      className={[
        "inline-flex min-h-6 items-center gap-1.5 text-[15px] font-semibold",
        rating !== null ? "text-accent" : "text-text-muted",
      ].join(" ")}
      aria-label={rating !== null ? `Personal rating ${rating}` : "No personal rating"}
      title={rating !== null ? `Personal rating: ${rating}` : "No personal rating"}
    >
      <Heart
        aria-hidden="true"
        className={[
          "h-5 w-5 shrink-0",
          rating !== null ? "fill-accent/20 text-accent" : "text-text-muted",
        ].join(" ")}
        strokeWidth={1.8}
      />
      <span className="tabnum">{rating !== null ? rating : "-"}</span>
    </span>
  );
}

function TmdbRatingBadge({ rating }: { rating: { value: number; voteCount: number | null } }) {
  const voteLabel = rating.voteCount
    ? ` from ${rating.voteCount.toLocaleString()} votes`
    : "";

  return (
    <span
      className="inline-flex h-6 max-w-full shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-border bg-background px-2 align-middle text-[11px] font-medium leading-none text-text-muted"
      title={`TMDB rating: ${rating.value}${voteLabel}`}
      aria-label={`TMDB rating ${rating.value}${voteLabel}`}
    >
      <span className="text-[9px] font-semibold uppercase tracking-normal text-text-faint">
        TMDB
      </span>
      <span className="tabnum text-text-2">{rating.value}</span>
    </span>
  );
}

function getTmdbRating(show: DetailShow) {
  if (show.tmdb_vote_average !== null && show.tmdb_vote_average !== undefined) {
    return {
      value: show.tmdb_vote_average,
      voteCount: show.tmdb_vote_count ?? null,
    };
  }

  return null;
}

function statusLabelFor(status: MediaStatus) {
  if (status === "wishlist") {
    return "Wishlist";
  }

  if (status === "watched") {
    return "Watched";
  }

  return "In Library";
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
