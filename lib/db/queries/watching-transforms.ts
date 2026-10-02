import type { WatchingShow } from "@/lib/db/types";

export type WatchingShowRow = {
  media_id: string;
  last_watched_at: string | null;
  media_items: { id: string; title: string; poster_path: string | null; backdrop_path: string | null } | null;
};

export type WatchingEpisodeRow = {
  id: string;
  show_id: string;
  season_number: number;
  episode_number: number;
  title: string;
  air_date: string | null;
};

// Specials (season 0) are hidden on show detail by default, so they never count toward progress or
// become the next episode here. The next episode is the first unwatched, already-aired one in season order. Unaired episodes are
// never "next", so a show that is waiting on new episodes shows no episode line.
export function buildWatchingShows({
  showRows,
  episodeRows,
  watchedEpisodeIds,
  today,
}: {
  showRows: WatchingShowRow[];
  episodeRows: WatchingEpisodeRow[];
  watchedEpisodeIds: Set<string>;
  today: string;
}): WatchingShow[] {
  const episodesByShow = new Map<string, WatchingEpisodeRow[]>();
  for (const episode of episodeRows) {
    const list = episodesByShow.get(episode.show_id) ?? [];
    list.push(episode);
    episodesByShow.set(episode.show_id, list);
  }

  const shows = showRows.flatMap((row) => {
    if (!row.media_items) return [];
    const episodes = (episodesByShow.get(row.media_id) ?? []).filter((episode) => episode.season_number !== 0).sort(
      (a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number,
    );
    const next = episodes.find(
      (episode) => !watchedEpisodeIds.has(episode.id) && (episode.air_date === null || episode.air_date <= today),
    );

    return [{
      id: row.media_id,
      title: row.media_items.title,
      posterPath: row.media_items.poster_path,
      backdropPath: row.media_items.backdrop_path,
      lastWatchedAt: row.last_watched_at,
      watchedEpisodeCount: episodes.filter((episode) => watchedEpisodeIds.has(episode.id)).length,
      totalEpisodeCount: episodes.length,
      nextEpisode: next
        ? { id: next.id, seasonNumber: next.season_number, episodeNumber: next.episode_number, title: next.title }
        : null,
    } satisfies WatchingShow];
  });

  // Most recently watched first; shows never watched sink to the bottom.
  return shows.sort((a, b) => (b.lastWatchedAt ?? "").localeCompare(a.lastWatchedAt ?? ""));
}
