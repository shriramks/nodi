import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildLibraryStats,
  type TagAnalyticsRow,
  type WatchLogAnalyticsRow,
} from "./stats-transforms";

const analyticsPageSize = 1000;

export async function getLibraryStats() {
  const user = await requireUser();

  const [watchRows, tagRows] = await Promise.all([
    listWatchLogAnalyticsRows(user.id),
    listTagAnalyticsRows(user.id),
  ]);

  return buildLibraryStats(watchRows, tagRows);
}

async function listWatchLogAnalyticsRows(userId: string) {
  const supabase = await createSupabaseServerClient();
  const rows: WatchLogAnalyticsRow[] = [];

  for (let offset = 0; ; offset += analyticsPageSize) {
    const { data, error } = await supabase
      .from("watch_logs")
      .select("id, movie_id, watched_at, movies(id, runtime_minutes, original_language, primary_genre_name)")
      .eq("user_id", userId)
      .order("watched_at", { ascending: true })
      .range(offset, offset + analyticsPageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load watch-log analytics rows.", error);
    }

    const page = (data ?? []) as unknown as WatchLogAnalyticsRow[];
    rows.push(...page);

    if (page.length < analyticsPageSize) {
      return rows;
    }
  }
}

async function listTagAnalyticsRows(userId: string) {
  const supabase = await createSupabaseServerClient();
  const rows: TagAnalyticsRow[] = [];

  for (let offset = 0; ; offset += analyticsPageSize) {
    const { data, error } = await supabase
      .from("user_movie_tags")
      .select("movie_id, tags(id, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + analyticsPageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load tag analytics rows.", error);
    }

    const page = (data ?? []) as unknown as TagAnalyticsRow[];
    rows.push(...page);

    if (page.length < analyticsPageSize) {
      return rows;
    }
  }
}
