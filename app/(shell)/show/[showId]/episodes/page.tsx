import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ShowEpisodeListView } from "@/components/show/show-episode-list-view";
import { getShowDetail, type ShowDetail } from "@/lib/db/queries";
import { ingestTmdbShow, refreshShowWatchedState } from "@/lib/db/mutations";
import { isAppError } from "@/lib/errors";
import {
  getTmdbTvDetailsWithAuth,
  getTmdbTvSeasonDetailsWithAuth,
  loadTmdbAuthForCurrentUser,
  type TmdbTvSeasonDetails,
} from "@/lib/providers/tmdb/client";
import { EpisodeWatchButton, SeasonWatchButton } from "../episode-watch-client";

type ShowEpisodesPageProps = {
  params: Promise<{ showId: string }>;
};

export async function generateMetadata({
  params,
}: ShowEpisodesPageProps): Promise<Metadata> {
  const { showId } = await params;
  const show = await loadShowOrNotFound(showId);
  return { title: `${show.title} Episodes` };
}

export default async function ShowEpisodesPage({
  params,
}: ShowEpisodesPageProps) {
  const { showId } = await params;
  let show = await loadShowOrNotFound(showId);

  if (await hydrateShowEpisodesOnDemand(show)) {
    show = await loadFreshShowOrNotFound(showId);
  }

  // Repair stale "watching" status for shows where all episodes have been
  // marked watched (e.g. synced from Trakt before auto-promotion existed).
  if (show.userMedia?.status === "watching") {
    const totalEpisodes = show.seasons.reduce((c, s) => c + s.episodes.length, 0);
    const watchedEpisodes = show.seasons.reduce(
      (c, s) => c + s.episodes.filter((ep) => (ep.watchActivity?.length ?? 0) > 0).length,
      0,
    );
    const episodeCountCovers =
      show.episode_count === null || totalEpisodes >= show.episode_count;
    if (totalEpisodes > 0 && watchedEpisodes >= totalEpisodes && episodeCountCovers) {
      await refreshShowWatchedState(show.id);
      show = await loadFreshShowOrNotFound(showId);
    }
  }

  return (
    <ShowEpisodeListView
      episodeWatchControl={(episode) => (
        <EpisodeWatchButton
          episodeId={episode.id}
          isWatched={(episode.watchActivity?.length ?? 0) > 0}
          showId={show.id}
        />
      )}
      seasonWatchControl={(season) => (
        <SeasonWatchButton
          seasonNumber={season.seasonNumber}
          showId={show.id}
          unwatchedCount={
            season.episodes.filter((episode) => (episode.watchActivity?.length ?? 0) === 0).length
          }
        />
      )}
      show={{
        ...show,
        userStatus: show.userMedia?.status ?? null,
        personalRating: show.userMedia?.personal_rating ?? null,
      }}
    />
  );
}

async function loadShowOrNotFound(showId: string) {
  try {
    return await loadInitialShow(showId);
  } catch (error) {
    if (
      isAppError(error) &&
      (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR")
    ) {
      notFound();
    }

    throw error;
  }
}

const loadInitialShow = cache(getShowDetail);

async function loadFreshShowOrNotFound(showId: string) {
  try {
    return await getShowDetail(showId);
  } catch (error) {
    if (
      isAppError(error) &&
      (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR")
    ) {
      notFound();
    }

    throw error;
  }
}

async function hydrateShowEpisodesOnDemand(show: ShowDetail) {
  if (!needsEpisodeHydration(show)) {
    return false;
  }

  const tmdbId = show.providerMappings.find(
    (mapping) => mapping.provider === "tmdb" && mapping.provider_media_type === "show",
  )?.provider_id;

  if (!tmdbId || !/^\d+$/.test(tmdbId)) {
    return false;
  }

  try {
    const auth = await loadTmdbAuthForCurrentUser();
    const detail = await getTmdbTvDetailsWithAuth(auth, Number(tmdbId));
    const seasonsToHydrate = (detail.seasons ?? []).filter(
      (season) => season.season_number >= 0 && (season.episode_count ?? 0) > 0,
    );
    const seasons: TmdbTvSeasonDetails[] = await Promise.all(
      seasonsToHydrate.map((season) =>
        getTmdbTvSeasonDetailsWithAuth(auth, Number(tmdbId), season.season_number),
      ),
    );

    await ingestTmdbShow(detail, seasons);
    return true;
  } catch (error) {
    if (isAppError(error) && (error.status === 404 || error.status === 409)) {
      return false;
    }

    console.error("Lazy TMDB show episode hydration failed", {
      error,
      showId: show.id,
      tmdbId,
    });
    return false;
  }
}

/** Re-sync from TMDB when metadata hasn't been refreshed in this many days. */
const STALE_METADATA_DAYS = 3;

function needsEpisodeHydration(show: ShowDetail) {
  const episodeCount = show.seasons.reduce(
    (count, season) => count + season.episodes.length,
    0,
  );

  // Always hydrate if we have fewer episodes than the stored total.
  if (show.episode_count !== null && episodeCount < show.episode_count) {
    return true;
  }

  if (episodeCount === 0) {
    return true;
  }

  // For shows still being watched, re-sync if TMDB metadata is stale so
  // newly-aired episodes are picked up even when episode_count hasn't changed.
  if (show.userMedia?.status === "watching") {
    const updatedAt = show.metadata_updated_at
      ? new Date(show.metadata_updated_at).getTime()
      : 0;
    const ageMs = Date.now() - updatedAt;
    const staleCutoffMs = STALE_METADATA_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs > staleCutoffMs) {
      return true;
    }
  }

  return false;
}
