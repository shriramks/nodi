import "server-only";

import { ingestTmdbShow, refreshShowCompletionStateIfTracked } from "@/lib/db/mutations";
import type { ShowDetail } from "@/lib/db/queries";
import { isAppError } from "@/lib/errors";
import {
  getTmdbTvDetailsWithAuth,
  getTmdbTvSeasonDetailsWithAuth,
  loadTmdbAuthForCurrentUser,
  type TmdbTvSeasonDetails,
} from "@/lib/providers/tmdb/client";
import { needsShowEpisodeHydration } from "@/lib/show/episode-hydration";

/**
 * Lazily re-sync a show's season/episode metadata from TMDB when the local copy
 * looks stale (see needsShowEpisodeHydration). Returns true when new metadata
 * was ingested and the caller should reload the show from the database.
 *
 * Shared by the show detail page and the episodes page so the hydration gate and
 * the post-ingest completion recompute stay in one place.
 */
export async function hydrateShowEpisodesOnDemand(show: ShowDetail): Promise<boolean> {
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
    // Newly-ingested seasons can leave an auto-completed show with unwatched
    // aired episodes; recompute so it drops out of "Done" immediately.
    await refreshShowCompletionStateIfTracked(show.id);
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
