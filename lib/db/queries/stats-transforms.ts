import type {
  LibraryStats,
  LibraryStatsBreakdownItem,
  LibraryStatsRatingBucket,
  LibraryStatsTimeBucket,
  Movie,
  Tag,
  UserMovieTag,
  WatchLog,
} from "@/lib/db/types";

const maxBreakdownItems = 10;
const unknownKey = "unknown";
const unknownLabel = "Unknown";
export const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type WatchLogAnalyticsMovie = Pick<
  Movie,
  "id" | "runtime_minutes" | "original_language" | "primary_genre_name" | "release_year"
>;

export type WatchLogAnalyticsRow = Pick<WatchLog, "id" | "movie_id" | "watched_at"> & {
  movies: WatchLogAnalyticsMovie | null;
};

export type TagAnalyticsRow = Pick<UserMovieTag, "movie_id"> & {
  tags: Pick<Tag, "id" | "name"> | null;
};

export type RatingAnalyticsRow = {
  personal_rating: number | null;
};

type WatchedMovieSummary = {
  movieId: string;
  originalLanguage: string | null;
  primaryGenreName: string | null;
  releaseYear: number | null;
};

export function buildLibraryStats(
  watchRows: WatchLogAnalyticsRow[],
  tagRows: TagAnalyticsRow[],
  ratingRows: RatingAnalyticsRow[],
): LibraryStats {
  const watchedMovies = buildWatchedMovies(watchRows);
  const watchedMovieIds = new Set(watchedMovies.map((movie) => movie.movieId));
  const runtimeMinutes = watchRows.reduce(
    (total, row) => total + (row.movies?.runtime_minutes ?? 0),
    0,
  );

  const genreBreakdown = buildMovieBreakdown(watchedMovies, (movie) => {
    const genre = movie.primaryGenreName?.trim();
    return {
      key: genre ? genre.toLowerCase() : unknownKey,
      label: genre || unknownLabel,
    };
  });

  const favGenreItem = genreBreakdown.find((g) => g.key !== unknownKey);

  return {
    watchedCount: watchedMovies.length,
    watchEventCount: watchRows.length,
    runtimeMinutes,
    avgRuntimeMinutes: watchedMovies.length > 0 ? Math.round(runtimeMinutes / watchedMovies.length) : 0,
    avgRating: computeAvgRating(ratingRows),
    favGenre: favGenreItem?.label ?? null,
    favGenreCount: favGenreItem?.count ?? null,
    favDecade: buildFavDecade(watchedMovies),
    ameleWatchMinutes: buildTagWatchMinutes(watchRows, tagRows, watchedMovieIds, "amele"),
    monthBuckets: buildMonthBuckets(watchRows),
    yearBuckets: buildYearBuckets(watchRows),
    genreBreakdown,
    languageBreakdown: buildMovieBreakdown(watchedMovies, (movie) => {
      const language = movie.originalLanguage?.trim();
      return {
        key: language ? language.toLowerCase() : unknownKey,
        label: formatLanguageLabel(language),
      };
    }),
    tagBreakdown: buildTagBreakdown(tagRows, watchedMovieIds, watchedMovies.length),
    ratingBreakdown: buildRatingBreakdown(ratingRows),
  };
}

function buildWatchedMovies(rows: WatchLogAnalyticsRow[]): WatchedMovieSummary[] {
  const movies = new Map<string, WatchedMovieSummary>();

  for (const row of rows) {
    if (movies.has(row.movie_id)) {
      continue;
    }

    movies.set(row.movie_id, {
      movieId: row.movie_id,
      originalLanguage: row.movies?.original_language ?? null,
      primaryGenreName: row.movies?.primary_genre_name ?? null,
      releaseYear: row.movies?.release_year ?? null,
    });
  }

  return Array.from(movies.values());
}

function computeAvgRating(rows: RatingAnalyticsRow[]): number | null {
  const ratings = rows.map((r) => r.personal_rating).filter((r): r is number => r !== null);
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

function buildFavDecade(movies: WatchedMovieSummary[]): string | null {
  const counts = new Map<number, number>();
  for (const movie of movies) {
    if (movie.releaseYear === null) continue;
    const decade = Math.floor(movie.releaseYear / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const best = Array.from(counts.entries()).reduce((a, b) => (b[1] > a[1] ? b : a));
  return `${best[0]}s`;
}

function buildMonthBuckets(rows: WatchLogAnalyticsRow[]): LibraryStatsTimeBucket[] {
  if (rows.length === 0) return [];

  let earliest = Infinity;
  let latest = 0;

  for (const row of rows) {
    const ts = Date.parse(row.watched_at);
    if (!Number.isNaN(ts)) {
      earliest = Math.min(earliest, ts);
      latest = Math.max(latest, ts);
    }
  }

  if (latest === 0) return [];

  const earliestMonth = monthStart(new Date(earliest));
  const latestMonth = monthStart(new Date(latest));

  const buckets = new Map<string, LibraryStatsTimeBucket>();
  let current = earliestMonth;
  while (current <= latestMonth) {
    const key = monthKey(current);
    buckets.set(key, {
      key,
      label: formatMonthLabel(current),
      count: 0,
      runtimeMinutes: 0,
    });
    current = addUtcMonths(current, 1);
  }

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

function buildYearBuckets(rows: WatchLogAnalyticsRow[]): LibraryStatsTimeBucket[] {
  if (rows.length === 0) return [];

  let earliestYear = Infinity;
  let latestYear = 0;

  for (const row of rows) {
    const ts = Date.parse(row.watched_at);
    if (!Number.isNaN(ts)) {
      const year = new Date(ts).getUTCFullYear();
      earliestYear = Math.min(earliestYear, year);
      latestYear = Math.max(latestYear, year);
    }
  }

  if (latestYear === 0) return [];

  const buckets = new Map<string, LibraryStatsTimeBucket>();
  for (let year = earliestYear; year <= latestYear; year++) {
    const key = String(year);
    buckets.set(key, { key, label: key, count: 0, runtimeMinutes: 0 });
  }

  for (const row of rows) {
    const ts = Date.parse(row.watched_at);
    if (!Number.isNaN(ts)) {
      const key = String(new Date(ts).getUTCFullYear());
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.runtimeMinutes += row.movies?.runtime_minutes ?? 0;
      }
    }
  }

  return Array.from(buckets.values());
}

function buildRatingBreakdown(rows: RatingAnalyticsRow[]): LibraryStatsRatingBucket[] {
  if (rows.length === 0) return [];

  const counts = new Map<number, number>();
  for (let r = 1; r <= 10; r++) counts.set(r, 0);

  for (const row of rows) {
    const r = row.personal_rating;
    if (r !== null && r >= 1 && r <= 10) {
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([rating, count]) => ({ rating, count }))
    .sort((a, b) => a.rating - b.rating);
}

function buildMovieBreakdown(
  movies: WatchedMovieSummary[],
  getGroup: (movie: WatchedMovieSummary) => Pick<LibraryStatsBreakdownItem, "key" | "label">,
): LibraryStatsBreakdownItem[] {
  const groups = new Map<string, LibraryStatsBreakdownItem>();

  for (const movie of movies) {
    const group = getGroup(movie);
    const item = groups.get(group.key) ?? {
      ...group,
      count: 0,
      percentage: 0,
    };

    item.count += 1;
    groups.set(group.key, item);
  }

  return finalizeBreakdown(groups, movies.length);
}

function buildTagWatchMinutes(
  watchRows: WatchLogAnalyticsRow[],
  tagRows: TagAnalyticsRow[],
  watchedMovieIds: Set<string>,
  tagName: string,
): number {
  const movieRuntime = new Map<string, number>();
  for (const row of watchRows) {
    if (!movieRuntime.has(row.movie_id) && watchedMovieIds.has(row.movie_id)) {
      movieRuntime.set(row.movie_id, row.movies?.runtime_minutes ?? 0);
    }
  }

  const tagMovieIds = new Set<string>();
  for (const row of tagRows) {
    if (row.tags?.name.toLowerCase() === tagName.toLowerCase() && watchedMovieIds.has(row.movie_id)) {
      tagMovieIds.add(row.movie_id);
    }
  }

  let total = 0;
  for (const movieId of tagMovieIds) {
    total += movieRuntime.get(movieId) ?? 0;
  }
  return total;
}

function buildTagBreakdown(
  rows: TagAnalyticsRow[],
  watchedMovieIds: Set<string>,
  watchedMovieCount: number,
): LibraryStatsBreakdownItem[] {
  const groups = new Map<string, LibraryStatsBreakdownItem>();
  const countedPairs = new Set<string>();

  for (const row of rows) {
    if (!row.tags || !watchedMovieIds.has(row.movie_id)) {
      continue;
    }

    const pairKey = `${row.tags.id}:${row.movie_id}`;

    if (countedPairs.has(pairKey)) {
      continue;
    }

    const item = groups.get(row.tags.id) ?? {
      key: row.tags.id,
      label: row.tags.name,
      count: 0,
      percentage: 0,
    };

    item.count += 1;
    countedPairs.add(pairKey);
    groups.set(row.tags.id, item);
  }

  return finalizeBreakdown(groups, watchedMovieCount);
}

function finalizeBreakdown(groups: Map<string, LibraryStatsBreakdownItem>, totalCount: number) {
  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
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

function formatMonthLabel(date: Date) {
  const month = monthLabels[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(2);
  return `${month} '${year}`;
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
