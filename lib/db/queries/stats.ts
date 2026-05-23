import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildLibraryStats,
  buildWatchedLibrarySummary,
  type RatingAnalyticsRow,
  type TagAnalyticsRow,
  type WatchLogAnalyticsRow,
  type WatchedLibrarySummaryRow,
} from "./stats-transforms";

const analyticsPageSize = 1000;

export async function getLibraryStats(tagFilter?: string, yearFilter?: string) {
  const user = await requireUser();

  const [watchRows, tagRows, ratingRows] = await Promise.all([
    listWatchLogAnalyticsRows(user.id),
    listTagAnalyticsRows(user.id),
    listRatingAnalyticsRows(user.id),
  ]);

  return buildLibraryStats(watchRows, tagRows, ratingRows, tagFilter, yearFilter);
}

export async function getWatchedLibrarySummary() {
  const user = await requireUser();
  const watchRows = await listWatchedLibrarySummaryRows(user.id);

  return buildWatchedLibrarySummary(watchRows);
}

async function listWatchLogAnalyticsRows(userId: string) {
  const supabase = await createSupabaseServerClient();
  const rows: WatchLogAnalyticsRow[] = [];

  for (let offset = 0; ; offset += analyticsPageSize) {
    const { data, error } = await supabase
      .from("watch_logs")
      .select("id, movie_id, watched_at, movies(id, runtime_minutes, original_language, primary_genre_name, release_year)")
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

async function listWatchedLibrarySummaryRows(userId: string) {
  const supabase = await createSupabaseServerClient();
  const rows: WatchedLibrarySummaryRow[] = [];

  for (let offset = 0; ; offset += analyticsPageSize) {
    const { data, error } = await supabase
      .from("watch_logs")
      .select("movie_id, watched_at, movies(original_language, primary_genre_name)")
      .eq("user_id", userId)
      .order("watched_at", { ascending: true })
      .range(offset, offset + analyticsPageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load watched-library summary rows.", error);
    }

    const page = (data ?? []) as unknown as WatchedLibrarySummaryRow[];
    rows.push(...page);

    if (page.length < analyticsPageSize) {
      return rows;
    }
  }
}

async function listRatingAnalyticsRows(userId: string): Promise<RatingAnalyticsRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_movies")
    .select("movie_id, personal_rating")
    .eq("user_id", userId)
    .eq("status", "watched")
    .not("personal_rating", "is", null);

  if (error) {
    throwDatabaseError("Failed to load rating analytics.", error);
  }

  return (data ?? []) as RatingAnalyticsRow[];
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
