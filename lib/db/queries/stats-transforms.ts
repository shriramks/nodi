import type {
  LibraryStats,
  LibraryStatsBreakdownItem,
  LibraryStatsRatingBucket,
  LibraryStatsTimeBucket,
  MediaType,
  MediaTypeFilter,
  Movie,
  Tag,
  MediaItem,
  Episode,
  UserMedia,
  UserMediaTag,
  UserMovieTag,
  WatchedLibrarySummary,
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

export type WatchedLibrarySummaryMovie = Pick<
  Movie,
  "original_language" | "primary_genre_name"
>;

export type WatchedLibrarySummaryRow = Pick<WatchLog, "movie_id" | "watched_at"> & {
  movies: WatchedLibrarySummaryMovie | null;
};

export type TagAnalyticsRow = Pick<UserMovieTag, "movie_id"> & {
  tags: Pick<Tag, "id" | "name"> | null;
};

export type RatingAnalyticsRow = {
  movie_id: string;
  personal_rating: number | null;
};

export type MediaStatsWatchRow = {
  id: string;
  media_id: string;
  episode_id: string | null;
  watched_at: string;
  media_items: Pick<
    MediaItem,
    "id" | "type" | "runtime_minutes" | "original_language" | "primary_genre_name" | "release_year"
  > | null;
  episodes?: Pick<Episode, "runtime_minutes"> | null;
};

export type MediaStatsTagRow = Pick<UserMediaTag, "media_id"> & {
  tags: Pick<Tag, "id" | "name"> | null;
};

export type MediaStatsRatingRow = {
  media_id: string;
  personal_rating: number | null;
};

export type MediaStatsStateRow = Pick<
  UserMedia,
  "media_id" | "status" | "personal_rating" | "last_watched_at" | "completed_at"
> & {
  media_items: Pick<
    MediaItem,
    "id" | "type" | "runtime_minutes" | "original_language" | "primary_genre_name" | "release_year"
  > | null;
};

type WatchedMovieSummary = {
  movieId: string;
  originalLanguage: string | null;
  primaryGenreName: string | null;
  releaseYear: number | null;
};

type WatchedMediaSummary = {
  mediaId: string;
  type: MediaType;
  originalLanguage: string | null;
  primaryGenreName: string | null;
  releaseYear: number | null;
};

type WatchedMovieSourceRow = Pick<WatchLog, "movie_id"> & {
  movies:
    | (Pick<Movie, "original_language" | "primary_genre_name"> &
        Partial<Pick<Movie, "release_year">>)
    | null;
};

type TimeBucketSourceRow = Pick<WatchLog, "watched_at"> & {
  movies?:
    | Partial<Pick<Movie, "runtime_minutes">>
    | WatchedLibrarySummaryMovie
    | null;
  media_items?: Partial<Pick<MediaItem, "runtime_minutes" | "type">> | null;
  episodes?: Partial<Pick<Episode, "runtime_minutes">> | null;
};

export function buildLibraryStats(
  watchRows: WatchLogAnalyticsRow[],
  tagRows: TagAnalyticsRow[],
  ratingRows: RatingAnalyticsRow[],
  tagFilter?: string,
  yearFilter?: string,
): LibraryStats {
  let filteredWatchRows = watchRows;
  let filteredRatingRows = ratingRows;

  if (tagFilter) {
    const taggedMovieIds = new Set<string>();
    for (const row of tagRows) {
      if (row.tags?.name.toLowerCase() === tagFilter.toLowerCase()) {
        taggedMovieIds.add(row.movie_id);
      }
    }
    filteredWatchRows = watchRows.filter((r) => taggedMovieIds.has(r.movie_id));
    filteredRatingRows = ratingRows.filter((r) => taggedMovieIds.has(r.movie_id));
  }

  const availableYearBuckets = buildYearBuckets(filteredWatchRows);
  if (yearFilter) {
    filteredWatchRows = filteredWatchRows.filter((row) => watchedYear(row) === yearFilter);
    const filteredYearMovieIds = new Set(filteredWatchRows.map((row) => row.movie_id));
    filteredRatingRows = filteredRatingRows.filter((row) => filteredYearMovieIds.has(row.movie_id));
  }

  const watchedMovies = buildWatchedMovies(filteredWatchRows);
  const watchedMovieIds = new Set(watchedMovies.map((movie) => movie.movieId));
  const runtimeMinutes = filteredWatchRows.reduce(
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
    watchEventCount: filteredWatchRows.length,
    movieCount: watchedMovies.length,
    showCount: 0,
    episodeWatchCount: 0,
    runtimeMinutes,
    movieRuntimeMinutes: runtimeMinutes,
    showRuntimeMinutes: 0,
    avgRuntimeMinutes: watchedMovies.length > 0 ? Math.round(runtimeMinutes / watchedMovies.length) : 0,
    avgRating: computeAvgRating(filteredRatingRows),
    favGenre: favGenreItem?.label ?? null,
    favGenreCount: favGenreItem?.count ?? null,
    favDecade: buildFavDecade(watchedMovies),
    availableYearBuckets,
    monthBuckets: yearFilter ? buildMonthBucketsForYear(filteredWatchRows, yearFilter) : buildMonthBuckets(filteredWatchRows),
    yearBuckets: buildYearBuckets(filteredWatchRows),
    genreBreakdown,
    languageBreakdown: buildMovieBreakdown(watchedMovies, (movie) => {
      const language = movie.originalLanguage?.trim();
      return {
        key: language ? language.toLowerCase() : unknownKey,
        label: formatLanguageLabel(language),
      };
    }),
    tagBreakdown: buildTagBreakdown(tagRows, watchedMovieIds, watchedMovies.length),
    ratingBreakdown: buildRatingBreakdown(filteredRatingRows),
  };
}

export function buildMediaLibraryStats(
  watchRows: MediaStatsWatchRow[],
  tagRows: MediaStatsTagRow[],
  ratingRows: MediaStatsRatingRow[],
  stateRows: MediaStatsStateRow[],
  typeFilter: MediaTypeFilter = "all",
  tagFilter?: string,
  yearFilter?: string,
): LibraryStats {
  let filteredWatchRows = watchRows;
  let filteredRatingRows = ratingRows;
  let filteredStateRows = stateRows;

  if (tagFilter) {
    const taggedMediaIds = new Set<string>();
    for (const row of tagRows) {
      if (row.tags?.name.toLowerCase() === tagFilter.toLowerCase()) {
        taggedMediaIds.add(row.media_id);
      }
    }

    filteredWatchRows = watchRows.filter((row) => taggedMediaIds.has(row.media_id));
    filteredRatingRows = ratingRows.filter((row) => taggedMediaIds.has(row.media_id));
    filteredStateRows = stateRows.filter((row) => taggedMediaIds.has(row.media_id));
  }

  const availableYearBuckets = buildMediaAvailableYearBuckets(
    filteredWatchRows,
    filteredStateRows,
    typeFilter,
  );
  if (yearFilter) {
    filteredWatchRows = filteredWatchRows.filter((row) => watchedYear(row) === yearFilter);
    filteredStateRows = filteredStateRows.filter((row) => stateWatchedYear(row) === yearFilter);
    const filteredYearMediaIds = new Set([
      ...filteredWatchRows.map((row) => row.media_id),
      ...filteredStateRows.map((row) => row.media_id),
    ]);
    filteredRatingRows = filteredRatingRows.filter((row) => filteredYearMediaIds.has(row.media_id));
  }

  const movieWatchRows = filteredWatchRows.filter((row) => row.media_items?.type === "movie");
  const showWatchRows = filteredWatchRows.filter((row) => row.media_items?.type === "show");
  const movieSummaries = buildWatchedMediaFromWatchRows(movieWatchRows);
  const showSummaries = buildWatchedMediaFromStateRows(filteredStateRows.filter((row) => row.media_items?.type === "show"));
  const watchedMedia = typeFilter === "movie"
    ? movieSummaries
    : typeFilter === "show"
      ? showSummaries
      : [...movieSummaries, ...showSummaries];
  const watchedMediaIds = new Set(watchedMedia.map((media) => media.mediaId));
  const movieRuntimeMinutes = movieWatchRows.reduce((total, row) => total + mediaWatchRuntime(row), 0);
  const showRuntimeMinutes = showWatchRows.reduce((total, row) => total + mediaWatchRuntime(row), 0);
  const runtimeMinutes = movieRuntimeMinutes + showRuntimeMinutes;
  const episodeWatchCount = countWatchedEpisodes(showWatchRows);
  const genreBreakdown = buildMediaBreakdown(watchedMedia, (media) => {
    const genre = media.primaryGenreName?.trim();
    return {
      key: genre ? genre.toLowerCase() : unknownKey,
      label: genre || unknownLabel,
    };
  });
  const favGenreItem = genreBreakdown.find((g) => g.key !== unknownKey);

  // For the "over time" chart, count movies (each watch event) + shows (one entry
  // per unique watched show, timestamped by completed_at / last_watched_at).
  const showStateRows = filteredStateRows.filter((row) => row.media_items?.type === "show");
  const showChartRows: TimeBucketSourceRow[] = [];
  const seenShowIds = new Set<string>();
  for (const row of showStateRows) {
    if (seenShowIds.has(row.media_id)) continue;
    const watchedAt = stateWatchedAt(row);
    if (watchedAt) {
      showChartRows.push({ watched_at: watchedAt, media_items: row.media_items });
      seenShowIds.add(row.media_id);
    }
  }
  const chartRows: TimeBucketSourceRow[] =
    typeFilter === "movie"
      ? movieWatchRows
      : typeFilter === "show"
        ? showChartRows
        : [...movieWatchRows, ...showChartRows];

  return {
    watchedCount: watchedMedia.length,
    watchEventCount: filteredWatchRows.length,
    movieCount: movieSummaries.length,
    showCount: showSummaries.length,
    episodeWatchCount,
    runtimeMinutes,
    movieRuntimeMinutes,
    showRuntimeMinutes,
    avgRuntimeMinutes: averageRuntimeMinutes({
      episodeWatchCount,
      mediaCount: watchedMedia.length,
      runtimeMinutes,
      typeFilter,
    }),
    avgRating: computeAvgMediaRating(filteredRatingRows),
    favGenre: favGenreItem?.label ?? null,
    favGenreCount: favGenreItem?.count ?? null,
    favDecade: buildFavMediaDecade(typeFilter === "show" ? showSummaries : movieSummaries),
    availableYearBuckets,
    monthBuckets: yearFilter ? buildMonthBucketsForYear(chartRows, yearFilter) : buildMonthBuckets(chartRows),
    yearBuckets: buildYearBuckets(chartRows),
    genreBreakdown,
    languageBreakdown: buildMediaBreakdown(watchedMedia, (media) => {
      const language = media.originalLanguage?.trim();
      return {
        key: language ? language.toLowerCase() : unknownKey,
        label: formatLanguageLabel(language),
      };
    }),
    tagBreakdown: buildMediaTagBreakdown(tagRows, watchedMediaIds, watchedMedia.length),
    ratingBreakdown: buildMediaRatingBreakdown(filteredRatingRows),
  };
}

function watchedYear(row: Pick<WatchLog, "watched_at">): string | null {
  const ts = Date.parse(row.watched_at);
  return Number.isNaN(ts) ? null : String(new Date(ts).getUTCFullYear());
}

function stateWatchedAt(row: MediaStatsStateRow): string | null {
  return row.completed_at ?? row.last_watched_at ?? null;
}

function stateWatchedYear(row: MediaStatsStateRow): string | null {
  const watchedAt = stateWatchedAt(row);
  if (!watchedAt) return null;
  const ts = Date.parse(watchedAt);
  return Number.isNaN(ts) ? null : String(new Date(ts).getUTCFullYear());
}

function buildMediaAvailableYearBuckets(
  watchRows: MediaStatsWatchRow[],
  stateRows: MediaStatsStateRow[],
  typeFilter: MediaTypeFilter,
) {
  const stateTimeRows = stateRows.flatMap((row) => {
    if (row.media_items?.type !== "show") {
      return [];
    }

    const watchedAt = stateWatchedAt(row);
    return watchedAt ? [{ watched_at: watchedAt, media_items: row.media_items }] : [];
  });

  if (typeFilter === "show") {
    return buildYearBuckets([...watchRows, ...stateTimeRows]);
  }

  if (typeFilter === "all") {
    return buildYearBuckets([...watchRows, ...stateTimeRows]);
  }

  return buildYearBuckets(watchRows);
}

export function buildWatchedLibrarySummary(
  watchRows: WatchedLibrarySummaryRow[],
): WatchedLibrarySummary {
  const watchedMovies = buildWatchedMovies(watchRows);

  return {
    watchedCount: watchedMovies.length,
    monthBuckets: buildMonthBuckets(watchRows),
    yearBuckets: buildYearBuckets(watchRows),
    genreBreakdown: buildMovieBreakdown(watchedMovies, (movie) => {
      const genre = movie.primaryGenreName?.trim();
      return {
        key: genre ? genre.toLowerCase() : unknownKey,
        label: genre || unknownLabel,
      };
    }),
    languageBreakdown: buildMovieBreakdown(watchedMovies, (movie) => {
      const language = movie.originalLanguage?.trim();
      return {
        key: language ? language.toLowerCase() : unknownKey,
        label: formatLanguageLabel(language),
      };
    }),
  };
}

function buildWatchedMovies(rows: WatchedMovieSourceRow[]): WatchedMovieSummary[] {
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

function buildWatchedMediaFromWatchRows(rows: MediaStatsWatchRow[]): WatchedMediaSummary[] {
  const mediaItems = new Map<string, WatchedMediaSummary>();

  for (const row of rows) {
    const media = row.media_items;
    if (!media || mediaItems.has(row.media_id)) {
      continue;
    }

    mediaItems.set(row.media_id, {
      mediaId: row.media_id,
      type: media.type,
      originalLanguage: media.original_language ?? null,
      primaryGenreName: media.primary_genre_name ?? null,
      releaseYear: media.release_year ?? null,
    });
  }

  return Array.from(mediaItems.values());
}

function buildWatchedMediaFromStateRows(rows: MediaStatsStateRow[]): WatchedMediaSummary[] {
  const mediaItems = new Map<string, WatchedMediaSummary>();

  for (const row of rows) {
    const media = row.media_items;
    if (!media || mediaItems.has(row.media_id)) {
      continue;
    }

    mediaItems.set(row.media_id, {
      mediaId: row.media_id,
      type: media.type,
      originalLanguage: media.original_language ?? null,
      primaryGenreName: media.primary_genre_name ?? null,
      releaseYear: media.release_year ?? null,
    });
  }

  return Array.from(mediaItems.values());
}

function computeAvgRating(rows: RatingAnalyticsRow[]): number | null {
  const ratings = rows.map((r) => r.personal_rating).filter((r): r is number => r !== null);
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

function computeAvgMediaRating(rows: MediaStatsRatingRow[]): number | null {
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

function buildFavMediaDecade(mediaItems: WatchedMediaSummary[]): string | null {
  const counts = new Map<number, number>();
  for (const media of mediaItems) {
    if (media.releaseYear === null) continue;
    const decade = Math.floor(media.releaseYear / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const best = Array.from(counts.entries()).reduce((a, b) => (b[1] > a[1] ? b : a));
  return `${best[0]}s`;
}

function averageRuntimeMinutes({
  episodeWatchCount,
  mediaCount,
  runtimeMinutes,
  typeFilter,
}: {
  episodeWatchCount: number;
  mediaCount: number;
  runtimeMinutes: number;
  typeFilter: MediaTypeFilter;
}) {
  if (typeFilter === "show") {
    return episodeWatchCount > 0 ? Math.round(runtimeMinutes / episodeWatchCount) : 0;
  }

  return mediaCount > 0 ? Math.round(runtimeMinutes / mediaCount) : 0;
}

function buildMonthBuckets(rows: TimeBucketSourceRow[]): LibraryStatsTimeBucket[] {
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
      bucket.runtimeMinutes += rowRuntimeMinutes(row);
    }
  }

  return Array.from(buckets.values());
}

function buildMonthBucketsForYear(rows: TimeBucketSourceRow[], year: string): LibraryStatsTimeBucket[] {
  const yearNumber = Number(year);
  if (!Number.isInteger(yearNumber)) return [];

  const buckets = new Map<string, LibraryStatsTimeBucket>();
  for (let month = 0; month < 12; month++) {
    const date = new Date(Date.UTC(yearNumber, month, 1));
    const key = monthKey(date);
    buckets.set(key, {
      key,
      label: monthLabels[month],
      count: 0,
      runtimeMinutes: 0,
    });
  }

  for (const row of rows) {
    const key = monthKey(new Date(row.watched_at));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.runtimeMinutes += rowRuntimeMinutes(row);
    }
  }

  return Array.from(buckets.values());
}

function runtimeMinutes(movie: TimeBucketSourceRow["movies"]) {
  return movie && "runtime_minutes" in movie ? movie.runtime_minutes ?? 0 : 0;
}

function rowRuntimeMinutes(row: TimeBucketSourceRow) {
  if (row.media_items) {
    if (row.media_items.type === "show") {
      return row.episodes?.runtime_minutes ?? row.media_items.runtime_minutes ?? 0;
    }

    return row.media_items.runtime_minutes ?? 0;
  }

  return runtimeMinutes(row.movies);
}

function mediaWatchRuntime(row: MediaStatsWatchRow) {
  if (row.media_items?.type === "show") {
    return row.episodes?.runtime_minutes ?? row.media_items.runtime_minutes ?? 0;
  }

  return row.media_items?.runtime_minutes ?? 0;
}

function countWatchedEpisodes(rows: MediaStatsWatchRow[]) {
  const episodeIds = new Set<string>();
  for (const row of rows) {
    if (row.episode_id) {
      episodeIds.add(row.episode_id);
    }
  }
  return episodeIds.size;
}

function buildYearBuckets(rows: TimeBucketSourceRow[]): LibraryStatsTimeBucket[] {
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
        bucket.runtimeMinutes += rowRuntimeMinutes(row);
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

function buildMediaRatingBreakdown(rows: MediaStatsRatingRow[]): LibraryStatsRatingBucket[] {
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

function buildMediaBreakdown(
  mediaItems: WatchedMediaSummary[],
  getGroup: (movie: WatchedMediaSummary) => Pick<LibraryStatsBreakdownItem, "key" | "label">,
): LibraryStatsBreakdownItem[] {
  const groups = new Map<string, LibraryStatsBreakdownItem>();

  for (const media of mediaItems) {
    const group = getGroup(media);
    const item = groups.get(group.key) ?? {
      ...group,
      count: 0,
      percentage: 0,
    };

    item.count += 1;
    groups.set(group.key, item);
  }

  return finalizeBreakdown(groups, mediaItems.length);
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

function buildMediaTagBreakdown(
  rows: MediaStatsTagRow[],
  watchedMediaIds: Set<string>,
  watchedMediaCount: number,
): LibraryStatsBreakdownItem[] {
  const groups = new Map<string, LibraryStatsBreakdownItem>();
  const countedPairs = new Set<string>();

  for (const row of rows) {
    if (!row.tags || !watchedMediaIds.has(row.media_id)) {
      continue;
    }

    const pairKey = `${row.tags.id}:${row.media_id}`;

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

  return finalizeBreakdown(groups, watchedMediaCount);
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
