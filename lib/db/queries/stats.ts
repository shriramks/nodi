import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import type {
  LibraryStats,
  LibraryStatsBreakdownItem,
  LibraryStatsTimeBucket,
  Movie,
  UserMovie,
  WatchLog,
} from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const analyticsPageSize = 1000;
const timeBucketCount = 6;
const maxBreakdownItems = 6;
const unknownKey = "unknown";
const unknownLabel = "Unknown";
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type WatchLogAnalyticsMovie = Pick<
  Movie,
  "id" | "runtime_minutes" | "original_language" | "primary_genre_name"
>;

type WatchLogAnalyticsRow = Pick<WatchLog, "id" | "movie_id" | "watched_at"> & {
  movies: WatchLogAnalyticsMovie | null;
};

type RatingRow = Pick<UserMovie, "movie_id" | "personal_rating">;

export async function getLibraryStats(): Promise<LibraryStats> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ count: toWatchCount, error: toWatchCountError }, watchRows, ratingRows] =
    await Promise.all([
      supabase
        .from("user_movies")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "to_watch"),
      listWatchLogAnalyticsRows(user.id),
      listRatingRows(user.id),
    ]);

  if (toWatchCountError) {
    throwDatabaseError("Failed to count to-watch movies.", toWatchCountError);
  }

  return buildLibraryStats(watchRows, ratingRows, toWatchCount ?? 0);
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

async function listRatingRows(userId: string) {
  const supabase = await createSupabaseServerClient();
  const rows: RatingRow[] = [];

  for (let offset = 0; ; offset += analyticsPageSize) {
    const { data, error } = await supabase
      .from("user_movies")
      .select("movie_id, personal_rating")
      .eq("user_id", userId)
      .not("personal_rating", "is", null)
      .order("updated_at", { ascending: false })
      .range(offset, offset + analyticsPageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load ratings.", error);
    }

    const page = (data ?? []) as RatingRow[];
    rows.push(...page);

    if (page.length < analyticsPageSize) {
      return rows;
    }
  }
}

function buildLibraryStats(
  watchRows: WatchLogAnalyticsRow[],
  ratingRows: RatingRow[],
  toWatchCount: number,
): LibraryStats {
  const watchedMovieIds = new Set(watchRows.map((row) => row.movie_id));
  const runtimeMinutes = watchRows.reduce(
    (total, row) => total + (row.movies?.runtime_minutes ?? 0),
    0,
  );
  const watchedLanguages = new Set(
    watchRows.flatMap((row) => {
      const language = row.movies?.original_language;
      return language ? [language] : [];
    }),
  );
  const ratingValues = ratingRows.flatMap((row) => {
    if (!watchedMovieIds.has(row.movie_id) || row.personal_rating === null) {
      return [];
    }

    return [row.personal_rating];
  });

  return {
    watchedCount: watchedMovieIds.size,
    watchEventCount: watchRows.length,
    toWatchCount,
    runtimeMinutes,
    hoursWatched: Math.round(runtimeMinutes / 60),
    averageRating: averageRating(ratingValues),
    rewatchCount: Math.max(watchRows.length - watchedMovieIds.size, 0),
    languageCount: watchedLanguages.size,
    timeBuckets: buildTimeBuckets(watchRows),
    genreBreakdown: buildBreakdown(watchRows, (row) => {
      const genre = row.movies?.primary_genre_name?.trim();

      return {
        key: genre ? genre.toLowerCase() : unknownKey,
        label: genre || unknownLabel,
      };
    }),
    languageBreakdown: buildBreakdown(watchRows, (row) => {
      const language = row.movies?.original_language?.trim();

      return {
        key: language ? language.toLowerCase() : unknownKey,
        label: formatLanguageLabel(language),
      };
    }),
  };
}

function averageRating(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}

function buildTimeBuckets(rows: WatchLogAnalyticsRow[]): LibraryStatsTimeBucket[] {
  if (rows.length === 0) {
    return [];
  }

  const latestWatchedAt = rows.reduce((latest, row) => {
    const watchedAt = Date.parse(row.watched_at);
    return Number.isNaN(watchedAt) ? latest : Math.max(latest, watchedAt);
  }, 0);

  if (latestWatchedAt === 0) {
    return [];
  }

  const latestMonth = monthStart(new Date(latestWatchedAt));
  const starts = Array.from({ length: timeBucketCount }, (_, index) =>
    addUtcMonths(latestMonth, index - (timeBucketCount - 1)),
  );
  const buckets = new Map(
    starts.map((start) => [
      monthKey(start),
      {
        key: monthKey(start),
        label: formatMonthLabel(start, latestMonth),
        count: 0,
        runtimeMinutes: 0,
      },
    ]),
  );

  for (const row of rows) {
    const key = monthKey(new Date(row.watched_at));
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.count += 1;
      bucket.runtimeMinutes += row.movies?.runtime_minutes ?? 0;
    }
  }

  return Array.from(buckets.values());
}

function buildBreakdown(
  rows: WatchLogAnalyticsRow[],
  getGroup: (row: WatchLogAnalyticsRow) => Pick<LibraryStatsBreakdownItem, "key" | "label">,
): LibraryStatsBreakdownItem[] {
  const groups = new Map<string, LibraryStatsBreakdownItem>();

  for (const row of rows) {
    const group = getGroup(row);
    const item = groups.get(group.key) ?? {
      ...group,
      count: 0,
      runtimeMinutes: 0,
      percentage: 0,
    };

    item.count += 1;
    item.runtimeMinutes += row.movies?.runtime_minutes ?? 0;
    groups.set(group.key, item);
  }

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      percentage: rows.length > 0 ? Math.round((item.count / rows.length) * 100) : 0,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (right.runtimeMinutes !== left.runtimeMinutes) {
        return right.runtimeMinutes - left.runtimeMinutes;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, maxBreakdownItems);
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function monthKey(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

function formatMonthLabel(date: Date, latestMonth: Date) {
  const month = monthLabels[date.getUTCMonth()];

  if (date.getUTCFullYear() === latestMonth.getUTCFullYear()) {
    return month;
  }

  return `${month} '${String(date.getUTCFullYear()).slice(2)}`;
}

function formatLanguageLabel(language: string | null | undefined) {
  if (!language) {
    return unknownLabel;
  }

  try {
    return (
      new Intl.DisplayNames(["en"], { type: "language" }).of(language) ?? language.toUpperCase()
    );
  } catch {
    return language.toUpperCase();
  }
}
