import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ShowEpisodeListView } from "@/components/show/show-episode-list-view";
import { ShowRatingSheet } from "@/components/show/show-state-actions";
import { getShowDetail, type ShowDetail } from "@/lib/db/queries";
import { ingestTmdbShow } from "@/lib/db/mutations";
import { isAppError } from "@/lib/errors";
import { needsShowEpisodeHydration } from "@/lib/show/episode-hydration";
import {
  getTmdbTvDetailsWithAuth,
  getTmdbTvSeasonDetailsWithAuth,
  loadTmdbAuthForCurrentUser,
  type TmdbTvSeasonDetails,
} from "@/lib/providers/tmdb/client";
import { EpisodeWatchButton, SeasonWatchButton, ShowCompletionRepair } from "../episode-watch-client";

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

  let show;
  try {
    show = await loadShowOrNotFound(showId);
  } catch (error) {
    console.error("[episodes] loadShowOrNotFound failed", { showId, error });
    throw error;
  }

  try {
    if (await hydrateShowEpisodesOnDemand(show)) {
      show = await loadFreshShowOrNotFound(showId);
    }
  } catch (error) {
    console.error("[episodes] hydrateShowEpisodesOnDemand or reload failed", { showId, error });
    throw error;
  }

  const personalRating = show.userMedia?.personal_rating ?? null;
  const userStatus = show.userMedia?.status ?? null;
  const needsCompletionRepair =
    show.userMedia?.status === "watching" ||
    show.userMedia?.completion_mode === "auto_all_aired";

  return (
    <>
    {needsCompletionRepair ? <ShowCompletionRepair showId={show.id} /> : null}
    <ShowEpisodeListView
      episodeWatchControl={(episode) => (
        <EpisodeWatchButton
          episodeId={episode.id}
          isWatched={(episode.watchActivity?.length ?? 0) > 0}
          showId={show.id}
        />
      )}
      ratingPicker={
        userStatus ? (
          <ShowRatingSheet currentRating={personalRating} showId={show.id} />
        ) : null
      }
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
        userStatus,
        personalRating,
      }}
    />
    </>
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
  if (!needsShowEpisodeHydration(show)) {
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
