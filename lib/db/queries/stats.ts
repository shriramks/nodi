import "server-only";

import { buildInsights } from "./insights-transforms";
import { buildMediaLibraryStats } from "./stats-transforms";
import { getMediaStatsInput } from "./media";
import type { MediaTypeFilter } from "@/lib/db/types";

const defaultCompanionTag = "amele";

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

// One analytics load feeds both the all-time totals and the companion insights.
export async function getInsightsPageData(type: MediaTypeFilter = "all") {
  const mediaStats = await getMediaStatsInput(type);

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
      tagRows: mediaStats.tagRows,
      ratingRows: mediaStats.ratingRows,
      companionTag: getCompanionTagName(),
    }),
  };
}
