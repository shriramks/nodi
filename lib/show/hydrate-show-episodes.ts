import "server-only";

import { ingestTmdbShow, refreshShowCompletionStateIfTracked } from "@/lib/db/mutations";
import type { ShowDetail } from "@/lib/db/queries";
import { AppError, isAppError } from "@/lib/errors";
import {
  getTmdbTvDetailsWithAuth,
  getTmdbTvSeasonDetailsWithAuth,
  loadTmdbAuthForCurrentUser,
  type TmdbTvDetails,
  type TmdbTvSeasonDetails,
} from "@/lib/providers/tmdb/client";
import { isActivelyTrackedShow, needsShowEpisodeHydration } from "@/lib/show/episode-hydration";

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
async function ingestShowFromTmdb(
  show: ShowDetail,
  tmdbId: string,
  prefetchedDetail?: TmdbTvDetails,
): Promise<void> {
  const auth = await loadTmdbAuthForCurrentUser();
  const detail = prefetchedDetail ?? (await getTmdbTvDetailsWithAuth(auth, Number(tmdbId)));
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

export type HydrateShowEpisodesResult = {
  /** New metadata was ingested; the caller should reload the show from the database. */
  hydrated: boolean;
  /**
   * A real sync error was swallowed (anything other than a 404/409, which just
   * mean "nothing to sync"). The caller should surface a retry affordance
   * instead of pretending the page is fully up to date.
   */
  failed: boolean;
};

async function performHydration(
  show: ShowDetail,
  tmdbId: string,
  prefetchedDetail?: TmdbTvDetails,
): Promise<HydrateShowEpisodesResult> {
  try {
    await ingestShowFromTmdb(show, tmdbId, prefetchedDetail);
    return { hydrated: true, failed: false };
  } catch (error) {
    if (isAppError(error) && (error.status === 404 || error.status === 409)) {
      return { hydrated: false, failed: false };
    }

    console.error("Lazy TMDB show episode hydration failed", {
      error,
      showId: show.id,
      tmdbId,
    });
    return { hydrated: false, failed: true };
  }
}

/**
 * Lazily re-sync a show's season/episode metadata from TMDB when the local copy
 * looks stale (see needsShowEpisodeHydration), or when a cheap live check
 * against TMDB shows a new episode landed before that staleness window elapsed
 * (Todo #194 -- catches a new season on page load instead of waiting up to
 * `STALE_METADATA_DAYS`).
 *
 * Errors are logged and swallowed (never thrown) so a TMDB/DB hiccup never
 * takes down the show page — the explicit refresh action below is the loud,
 * recoverable path — but `failed` is still reported back so the page can show
 * a retry notice instead of silently rendering stale data (see BUG-003 /
 * Todo #188).
 */
export async function hydrateShowEpisodesOnDemand(
  show: ShowDetail,
): Promise<HydrateShowEpisodesResult> {
  const tmdbId = showTmdbId(show);

  if (!tmdbId) {
    return { hydrated: false, failed: false };
  }

  if (needsShowEpisodeHydration(show)) {
    return performHydration(show, tmdbId);
  }

  if (!isActivelyTrackedShow(show)) {
    return { hydrated: false, failed: false };
  }

  try {
    const auth = await loadTmdbAuthForCurrentUser();
    const detail = await getTmdbTvDetailsWithAuth(auth, Number(tmdbId));
    const localEpisodeCount = show.seasons.reduce(
      (count, season) => count + season.episodes.length,
      0,
    );

    if ((detail.number_of_episodes ?? 0) <= localEpisodeCount) {
      return { hydrated: false, failed: false };
    }

    return await performHydration(show, tmdbId, detail);
  } catch (error) {
    if (isAppError(error) && (error.status === 404 || error.status === 409)) {
      return { hydrated: false, failed: false };
    }

    console.error("Live TMDB episode-count check failed", {
      error,
      showId: show.id,
      tmdbId,
    });
    return { hydrated: false, failed: true };
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
