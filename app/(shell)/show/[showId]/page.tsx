import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { LocalShowStateActions } from "@/components/show/show-state-actions";
import { ShowDetailView } from "@/components/show/show-detail-view";
import { getShowDetail, type ShowDetail } from "@/lib/db/queries";
import { ingestTmdbShow } from "@/lib/db/mutations";
import { isAppError } from "@/lib/errors";
import {
  getTmdbTvDetailsWithAuth,
  getTmdbTvSeasonDetailsWithAuth,
  loadTmdbAuthForCurrentUser,
  type TmdbTvSeasonDetails,
} from "@/lib/providers/tmdb/client";
import {
  addShowToWishlistAction,
  saveShowToLibraryAction,
} from "../actions";

type ShowDetailPageProps = {
  params: Promise<{ showId: string }>;
};

export async function generateMetadata({
  params,
}: ShowDetailPageProps): Promise<Metadata> {
  const { showId } = await params;
  const show = await loadShowOrNotFound(showId);
  return { title: show.title };
}

export default async function ShowDetailPage({ params }: ShowDetailPageProps) {
  const { showId } = await params;
  let show = await loadShowOrNotFound(showId);

  if (await hydrateShowEpisodesOnDemand(show)) {
    show = await loadFreshShowOrNotFound(showId);
  }

  return (
    <ShowDetailView
      actions={
        <LocalShowStateActions
          addToWishlist={addShowToWishlistAction.bind(null, show.id)}
          saveToLibrary={saveShowToLibraryAction.bind(null, show.id)}
          status={show.userMedia?.status ?? null}
        />
      }
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

function needsEpisodeHydration(show: ShowDetail) {
  const episodeCount = show.seasons.reduce(
    (count, season) => count + season.episodes.length,
    0,
  );

  if (show.episode_count !== null) {
    return episodeCount < show.episode_count;
  }

  return episodeCount === 0;
}
