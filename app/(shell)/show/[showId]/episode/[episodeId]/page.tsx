import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { EpisodeDetailView } from "@/components/show/episode-detail-view";
import { getEpisodeDetail, type EpisodeDetail } from "@/lib/db/queries";
import { isAppError } from "@/lib/errors";
import {
  getTmdbTvAggregateCreditsWithAuth,
  getTmdbTvEpisodeDetailsWithAuth,
  loadTmdbAuthForCurrentUser,
  type TmdbTvAggregateCredits,
  type TmdbTvEpisodeDetails,
} from "@/lib/providers/tmdb/client";
import { EpisodeDetailActions, EpisodeWatchHistoryEditor } from "../../episode-watch-client";

type EpisodeDetailPageProps = {
  params: Promise<{
    episodeId: string;
    showId: string;
  }>;
};

export async function generateMetadata({
  params,
}: EpisodeDetailPageProps): Promise<Metadata> {
  const { episodeId, showId } = await params;
  const detail = await loadEpisodeOrNotFound(showId, episodeId);
  return { title: `${detail.show.title}: ${detail.episode.title}` };
}

export default async function EpisodeDetailPage({
  params,
}: EpisodeDetailPageProps) {
  const { episodeId, showId } = await params;
  const { episode, show } = await loadEpisodeOrNotFound(showId, episodeId);
  const isWatched = episode.watchActivity.length > 0;
  const cast = await loadEpisodeCast(show, episode);

  return (
    <EpisodeDetailView
      actions={
        <EpisodeDetailActions
          episodeId={episode.id}
          isWatched={isWatched}
          showId={show.id}
        />
      }
      cast={cast}
      episode={episode}
      show={{
        ...show,
        userMedia: show.userMedia,
      }}
      watchHistory={
        <EpisodeWatchHistoryEditor
          activity={episode.watchActivity}
          episodeId={episode.id}
          showId={show.id}
        />
      }
    />
  );
}

async function loadEpisodeCast(
  show: EpisodeDetail["show"],
  episode: EpisodeDetail["episode"],
) {
  const tmdbId = show.providerMappings.find(
    (mapping) => mapping.provider === "tmdb" && mapping.provider_media_type === "show",
  )?.provider_id;

  if (!tmdbId || !/^\d+$/.test(tmdbId)) {
    return [];
  }

  try {
    const auth = await loadTmdbAuthForCurrentUser();
    const [detail, aggregate] = await Promise.all([
      getTmdbTvEpisodeDetailsWithAuth(
        auth,
        Number(tmdbId),
        episode.season_number,
        episode.episode_number,
      ),
      getTmdbTvAggregateCreditsWithAuth(auth, Number(tmdbId)),
    ]);

    // Lead with this episode's guest stars, then the show's regular cast,
    // dropping regulars who already appear as guest stars.
    const guestStars = toEpisodeGuestStars(detail);
    const guestIds = new Set(guestStars.map((member) => member.tmdb_person_id));
    const regularCast = toShowCast(aggregate).filter(
      (member) => !guestIds.has(member.tmdb_person_id),
    );

    return [...guestStars, ...regularCast];
  } catch (error) {
    if (isAppError(error) && error.status === 404) {
      return [];
    }

    console.error("TMDB episode cast load failed", {
      episodeId: episode.id,
      error,
      showId: show.id,
      tmdbId,
    });
    return [];
  }
}

function toEpisodeGuestStars(detail: TmdbTvEpisodeDetails) {
  return (detail.guest_stars ?? [])
    .slice()
    .sort((left, right) => (left.order ?? 9999) - (right.order ?? 9999))
    .slice(0, 12)
    .map((member) => ({
      id: member.id,
      tmdb_person_id: member.id,
      name: member.name,
      character_name: member.character?.trim() || null,
      profile_path: member.profile_path ?? null,
    }));
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

async function loadEpisode(showId: string, episodeId: string) {
  try {
    return await getEpisodeDetail(showId, episodeId);
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

const loadEpisodeOrNotFound = cache(loadEpisode);
