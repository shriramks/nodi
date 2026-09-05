import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  LocalShowStateActions,
  ShowRatingSheet,
  ShowTagEditor,
} from "@/components/show/show-state-actions";
import { ShowDetailView } from "@/components/show/show-detail-view";
import { getShowDetail, listTags, type ShowDetail } from "@/lib/db/queries";
import { isAppError } from "@/lib/errors";
import { hydrateShowEpisodesOnDemand } from "@/lib/show/hydrate-show-episodes";
import {
  getTmdbTvAggregateCreditsWithAuth,
  loadTmdbAuthForCurrentUser,
  type TmdbTvAggregateCredits,
} from "@/lib/providers/tmdb/client";
import {
  addShowToWishlistAction,
  markShowDoneAction,
  markShowStoppedAction,
  refreshShowFromTmdbAction,
  removeShowFromLibraryAction,
  resumeShowAction,
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

  const [hydrateResult, allTags, cast] = await Promise.all([
    hydrateShowEpisodesOnDemand(show),
    listTags(),
    loadShowCast(show),
  ]);
  if (hydrateResult.hydrated) {
    show = await loadFreshShowOrNotFound(showId);
  }
  const personalRating = show.userMedia?.personal_rating ?? null;
  const status = show.userMedia?.status ?? null;

  return (
    <ShowDetailView
      actions={
        <LocalShowStateActions
          addToWishlist={addShowToWishlistAction.bind(null, show.id)}
          markDone={markShowDoneAction.bind(null, show.id)}
          markStopped={markShowStoppedAction.bind(null, show.id)}
          removeFromLibrary={removeShowFromLibraryAction.bind(null, show.id)}
          resume={resumeShowAction.bind(null, show.id)}
          saveToLibrary={saveShowToLibraryAction.bind(null, show.id)}
          status={status}
        />
      }
      ratingPicker={
        status ? <ShowRatingSheet currentRating={personalRating} showId={show.id} /> : null
      }
      autoSyncFailed={hydrateResult.failed}
      refreshFromTmdb={status ? refreshShowFromTmdbAction.bind(null, show.id) : undefined}
      show={{
        ...show,
        cast,
        userStatus: status,
        personalRating,
      }}
      tagEditor={<ShowTagEditor allTags={allTags} showId={show.id} tags={show.tags} />}
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

async function loadShowCast(show: ShowDetail) {
  const tmdbId = show.providerMappings.find(
    (mapping) => mapping.provider === "tmdb" && mapping.provider_media_type === "show",
  )?.provider_id;

  if (!tmdbId || !/^\d+$/.test(tmdbId)) {
    return [];
  }

  try {
    const auth = await loadTmdbAuthForCurrentUser();
    const credits = await getTmdbTvAggregateCreditsWithAuth(auth, Number(tmdbId));
    return toShowCast(credits);
  } catch (error) {
    if (isAppError(error) && error.status === 404) {
      return [];
    }

    console.error("TMDB show cast load failed", {
      error,
      showId: show.id,
      tmdbId,
    });
    return [];
  }
}

function toShowCast(credits: TmdbTvAggregateCredits) {
  return (credits.cast ?? [])
    .slice()
    .sort((left, right) => (left.order ?? 9999) - (right.order ?? 9999))
    .slice(0, 12)
    .map((member) => ({
      id: member.id,
      tmdb_person_id: member.id,
      name: member.name,
      character_name: member.roles?.[0]?.character?.trim() || null,
      profile_path: member.profile_path ?? null,
    }));
}
