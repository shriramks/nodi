import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCompanionMonth } from "./insights-transforms";
import { getMediaStatsInput } from "./media";
import { getCompanionTagName } from "./stats";
import {
  buildWatchingShows,
  type WatchingEpisodeRow,
  type WatchingShowRow,
} from "./watching-transforms";

const pageSize = 1000;

// One load feeds the Now Watching screen: in-progress shows plus last month with the companion.
export async function getWatchingPageData() {
  const [shows, mediaStats] = await Promise.all([listWatchingShows(), getMediaStatsInput("all")]);

  return {
    shows,
    companionMonth: buildCompanionMonth({
      watchRows: mediaStats.watchRows,
      tagRows: mediaStats.tagRows,
      ratingRows: mediaStats.ratingRows,
      companionTag: getCompanionTagName(),
    }),
  };
}

async function listWatchingShows() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_media")
    .select("media_id, last_watched_at, media_items!inner(id, type, title, poster_path, backdrop_path)")
    .eq("user_id", user.id)
    .eq("status", "watching")
    .eq("media_items.type", "show");

  if (error) {
    throwDatabaseError("Failed to load shows in progress.", error);
  }

  const showRows = (data ?? []) as unknown as WatchingShowRow[];
  if (showRows.length === 0) return [];

  const showIds = showRows.map((row) => row.media_id);
  const [episodeRows, watchedEpisodeIds] = await Promise.all([
    listEpisodes(showIds),
    listWatchedEpisodeIds(user.id, showIds),
  ]);

  return buildWatchingShows({
    showRows,
    episodeRows,
    watchedEpisodeIds,
    today: new Date().toISOString().slice(0, 10),
  });
}

async function listEpisodes(showIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const rows: WatchingEpisodeRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("episodes")
      .select("id, show_id, season_number, episode_number, title, air_date")
      .in("show_id", showIds)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load episodes for shows in progress.", error);
    }

    const page = (data ?? []) as WatchingEpisodeRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function listWatchedEpisodeIds(userId: string, showIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const ids = new Set<string>();

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("media_watch_activity")
      .select("id, episode_id")
      .eq("user_id", userId)
      .in("media_id", showIds)
      .not("episode_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load watched episodes for shows in progress.", error);
    }

    const page = (data ?? []) as Array<{ id: string; episode_id: string | null }>;
    for (const row of page) {
      if (row.episode_id) ids.add(row.episode_id);
    }
    if (page.length < pageSize) return ids;
  }
}
