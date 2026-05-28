import "server-only";

import {
  buildMediaLibraryStats,
} from "./stats-transforms";
import { getMediaStatsInput } from "./media";
import type { MediaTypeFilter } from "@/lib/db/types";

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
