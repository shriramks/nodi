import "server-only";

import { throwDatabaseError } from "@/lib/db/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildInsights, type SeasonEpisodeRow } from "./insights-transforms";
import { buildMediaLibraryStats, type MediaStatsWatchRow } from "./stats-transforms";
import { getMediaStatsInput } from "./media";
import type { MediaTypeFilter } from "@/lib/db/types";

const defaultCompanionTag = "amele";
const episodePageSize = 1000;
const showIdChunkSize = 100;

export function getCompanionTagName() {
  return process.env.STAT_CO_WATCH_TAG?.trim() || defaultCompanionTag;
}

export async function getLibraryStats(
  type: MediaTypeFilter = "all",
  tagFilter?: string,
  yearFilter?: string,
) {
  const mediaStats = await getMediaStatsInput(type);

  return buildMediaLibraryStats(
    mediaStats.watchRows,
    mediaStats.tagRows,
    mediaStats.ratingRows,
    mediaStats.stateRows,
    type,
    tagFilter,
    yearFilter,
  );
}

// Every episode of every show that has a watch event, so a season can be judged complete.
export async function listSeasonEpisodes(watchRows: MediaStatsWatchRow[]) {
  const showIds = Array.from(
    new Set(watchRows.filter((row) => row.media_items?.type === "show").map((row) => row.media_id)),
  );
  const supabase = await createSupabaseServerClient();
  const rows: SeasonEpisodeRow[] = [];

  for (let start = 0; start < showIds.length; start += showIdChunkSize) {
    const chunk = showIds.slice(start, start + showIdChunkSize);

    for (let offset = 0; ; offset += episodePageSize) {
      const { data, error } = await supabase
        .from("episodes")
        .select("id, show_id, season_number")
        .in("show_id", chunk)
        .order("id", { ascending: true })
        .range(offset, offset + episodePageSize - 1);

      if (error) {
        throwDatabaseError("Failed to load episodes for season completion.", error);
      }

      const page = (data ?? []) as SeasonEpisodeRow[];
      rows.push(...page);
      if (page.length < episodePageSize) break;
    }
  }

  return rows;
}

// One analytics load feeds both the all-time totals and the companion insights.
export async function getInsightsPageData(type: MediaTypeFilter = "all") {
  const mediaStats = await getMediaStatsInput(type);
  const seasonEpisodes = await listSeasonEpisodes(mediaStats.watchRows);

  return {
    stats: buildMediaLibraryStats(
      mediaStats.watchRows,
      mediaStats.tagRows,
      mediaStats.ratingRows,
      mediaStats.stateRows,
      type,
    ),
    insights: buildInsights({
      watchRows: mediaStats.watchRows,
      seasonEpisodes,
      tagRows: mediaStats.tagRows,
      ratingRows: mediaStats.ratingRows,
      companionTag: getCompanionTagName(),
    }),
  };
}
