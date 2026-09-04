import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ShowEpisodeListView } from "@/components/show/show-episode-list-view";
import { ShowRatingSheet } from "@/components/show/show-state-actions";
import { getShowDetail } from "@/lib/db/queries";
import { isAppError } from "@/lib/errors";
import { hydrateShowEpisodesOnDemand } from "@/lib/show/hydrate-show-episodes";
import { toggleEpisodeWatchedAction, markSeasonWatchedAction } from "../../actions";

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

  return (
    <>
    <ShowEpisodeListView
      onMarkSeasonWatched={markSeasonWatchedAction}
      onToggleEpisodeWatched={toggleEpisodeWatchedAction}
      ratingPicker={
        userStatus ? (
          <ShowRatingSheet currentRating={personalRating} showId={show.id} />
        ) : null
      }
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

