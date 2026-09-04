import "server-only";

import { ingestTmdbShow, refreshShowCompletionStateIfTracked } from "@/lib/db/mutations";
import type { ShowDetail } from "@/lib/db/queries";
import { AppError, isAppError } from "@/lib/errors";
import {
  getTmdbTvDetailsWithAuth,
  getTmdbTvSeasonDetailsWithAuth,
  loadTmdbAuthForCurrentUser,
  type TmdbTvSeasonDetails,
} from "@/lib/providers/tmdb/client";
import { needsShowEpisodeHydration } from "@/lib/show/episode-hydration";

function showTmdbId(show: ShowDetail): string | null {
  const tmdbId = show.providerMappings.find(
    (mapping) => mapping.provider === "tmdb" && mapping.provider_media_type === "show",
  )?.provider_id;

  return tmdbId && /^\d+$/.test(tmdbId) ? tmdbId : null;
}

/**
 * Re-ingest a show's season/episode metadata from TMDB. Errors propagate — this
 * is the core used by both the lazy on-demand path (which swallows) and the
 * explicit "check for new episodes" action (which surfaces the failure).
 */
async function ingestShowFromTmdb(show: ShowDetail, tmdbId: string): Promise<void> {
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
}

/**
 * Lazily re-sync a show's season/episode metadata from TMDB when the local copy
 * looks stale (see needsShowEpisodeHydration). Returns true when new metadata
 * was ingested and the caller should reload the show from the database.
 *
 * Failures are logged and swallowed (returns false) so a TMDB/DB hiccup never
 * takes down the show page — the explicit refresh action below is the loud,
 * recoverable path.
 */
export async function hydrateShowEpisodesOnDemand(show: ShowDetail): Promise<boolean> {
  if (!needsShowEpisodeHydration(show)) {
    return false;
  }

  const tmdbId = showTmdbId(show);

  if (!tmdbId) {
    return false;
  }

  try {
    await ingestShowFromTmdb(show, tmdbId);
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

/**
 * Force a re-sync from TMDB regardless of the staleness gate, and let errors
 * propagate to the caller so the UI can show what went wrong. Backs the
 * "Check for new episodes" action on the show page.
 */
export async function refreshShowEpisodesFromTmdb(show: ShowDetail): Promise<void> {
  const tmdbId = showTmdbId(show);

  if (!tmdbId) {
    throw new AppError("This show has no TMDB link to refresh from.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  await ingestShowFromTmdb(show, tmdbId);
}
