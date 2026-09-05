import type { ShowDetail } from "@/lib/db/queries";

/** Re-sync from TMDB when metadata hasn't been refreshed in this many days. */
const STALE_METADATA_DAYS = 3;

/**
 * A show still gaining episodes from TMDB's perspective: actively being
 * watched, or auto-completed (which just means "all aired episodes watched
 * so far" -- a new season should pull it back out of Done).
 */
export function isActivelyTrackedShow(show: ShowDetail) {
  const status = show.userMedia?.status;
  const autoCompleted =
    status === "done" && show.userMedia?.completion_mode === "auto_all_aired";
  return status === "watching" || autoCompleted;
}

export function needsShowEpisodeHydration(show: ShowDetail) {
  const episodeCount = show.seasons.reduce(
    (count, season) => count + season.episodes.length,
    0,
  );

  // Trakt sync can create minimal shows and only the episodes present in watch
  // history. Those rows look complete locally until full TMDB enrichment runs.
  if (show.tmdb_enriched_at === null) {
    return true;
  }

  // Always hydrate if we have fewer episodes than the stored total.
  if (show.episode_count !== null && episodeCount < show.episode_count) {
    return true;
  }

  if (episodeCount === 0) {
    return true;
  }

  // Re-sync stale TMDB metadata so newly-aired episodes are picked up even when
  // the stored episode_count hasn't changed. This covers shows still being
  // watched and shows auto-completed on "all aired episodes watched" — the
  // latter is the state a returning series sits in between seasons, and the only
  // one that can otherwise never gain a whole new season.
  if (isActivelyTrackedShow(show)) {
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
