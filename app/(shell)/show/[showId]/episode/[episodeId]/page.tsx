import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { EpisodeDetailView } from "@/components/show/episode-detail-view";
import { getEpisodeDetail } from "@/lib/db/queries";
import { isAppError } from "@/lib/errors";
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

  return (
    <EpisodeDetailView
      actions={
        <EpisodeDetailActions
          episodeId={episode.id}
          isWatched={isWatched}
          showId={show.id}
        />
      }
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
