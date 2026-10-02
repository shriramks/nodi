import type {
  CompanionMonth,
  Insights,
  InsightsMonth,
  InsightsPeriodTotals,
  InsightsRatedTitle,
} from "@/lib/db/types";

import {
  mediaWatchRuntime,
  monthLabels,
  type MediaStatsRatingRow,
  type MediaStatsTagRow,
  type MediaStatsWatchRow,
} from "./stats-transforms";

const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DatedRow = { row: MediaStatsWatchRow; ts: number };

export type SeasonEpisodeRow = { id: string; show_id: string; season_number: number };

// A season counts as one title once every episode in it has been watched; `ts` is when the last
// episode was first watched.
type CompletedSeason = { showId: string; ts: number };

export function buildInsights({
  watchRows,
  seasonEpisodes,
  tagRows,
  ratingRows,
  companionTag,
  now = new Date(),
}: {
  watchRows: MediaStatsWatchRow[];
  seasonEpisodes: SeasonEpisodeRow[];
  tagRows: MediaStatsTagRow[];
  ratingRows: MediaStatsRatingRow[];
  companionTag: string;
  now?: Date;
}): Insights {
  const companionIds = companionMediaIds(tagRows, companionTag);
  const datedRows = datedWatchRows(watchRows);
  const seasons = completedSeasons(datedRows, seasonEpisodes);
  const ratings = new Map<string, number>();
  for (const row of ratingRows) {
    if (row.personal_rating !== null) ratings.set(row.media_id, row.personal_rating);
  }

  // "This year vs last year" always compares year-to-date against the same span of last year.
  const year = now.getUTCFullYear();
  const thisYear = { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
  const lastYear = {
    start: Date.UTC(year - 1, 0, 1),
    end: Date.UTC(year - 1, now.getUTCMonth(), now.getUTCDate() + 1),
  };

  const thisYearRows = rowsInWindow(datedRows, thisYear);
  const lastYearRows = rowsInWindow(datedRows, lastYear);
  const withThisYear = thisYearRows.filter(({ row }) => companionIds.has(row.media_id));
  const withLastYear = lastYearRows.filter(({ row }) => companionIds.has(row.media_id));
  const withoutThisYear = thisYearRows.filter(({ row }) => !companionIds.has(row.media_id));

  const withTotals = periodTotals(withThisYear, seasonsIn(seasons, thisYear, (id) => companionIds.has(id)));
  const withoutTotals = periodTotals(withoutThisYear, seasonsIn(seasons, thisYear, (id) => !companionIds.has(id)));
  const rated = ratedTitles(withThisYear, ratings);
  const { highestRated, lowestRated } = pickExtremes(rated);

  return {
    hasCompanionData: companionIds.size > 0 && datedRows.some(({ row }) => companionIds.has(row.media_id)),
    habits: buildHabits(datedRows.filter(({ row }) => companionIds.has(row.media_id))),
    thisYear: {
      year,
      withCompanion: withTotals,
      withCompanionLastYear: periodTotals(withLastYear, seasonsIn(seasons, lastYear, (id) => companionIds.has(id))),
      withoutCompanion: withoutTotals,
      highestRated,
      lowestRated,
      avgRating: averageRating(rated),
      avgRatingLastYear: averageRating(ratedTitles(withLastYear, ratings)),
    },
  };
}

function companionMediaIds(tagRows: MediaStatsTagRow[], companionTag: string) {
  const target = companionTag.trim().toLowerCase();
  const ids = new Set<string>();
  for (const row of tagRows) {
    if (row.tags && row.tags.name.trim().toLowerCase() === target) ids.add(row.media_id);
  }
  return ids;
}

function datedWatchRows(rows: MediaStatsWatchRow[]): DatedRow[] {
  const dated: DatedRow[] = [];
  for (const row of rows) {
    const ts = Date.parse(row.watched_at);
    if (!Number.isNaN(ts)) dated.push({ row, ts });
  }
  return dated;
}

function rowsInWindow(rows: DatedRow[], window: { start: number; end: number }) {
  return rows.filter(({ ts }) => ts >= window.start && ts < window.end);
}

function completedSeasons(rows: DatedRow[], seasonEpisodes: SeasonEpisodeRow[]): CompletedSeason[] {
  const firstWatched = new Map<string, number>();
  for (const { row, ts } of rows) {
    if (!row.episode_id) continue;
    const existing = firstWatched.get(row.episode_id);
    if (existing === undefined || ts < existing) firstWatched.set(row.episode_id, ts);
  }

  const seasons = new Map<string, { showId: string; ts: number; complete: boolean }>();
  for (const episode of seasonEpisodes) {
    const key = `${episode.show_id}:${episode.season_number}`;
    const season = seasons.get(key) ?? { showId: episode.show_id, ts: 0, complete: true };
    const watchedAt = firstWatched.get(episode.id);
    if (watchedAt === undefined) season.complete = false;
    else season.ts = Math.max(season.ts, watchedAt);
    seasons.set(key, season);
  }

  return Array.from(seasons.values()).filter((season) => season.complete);
}

function seasonsIn(
  seasons: CompletedSeason[],
  window: { start: number; end: number },
  includeShow: (showId: string) => boolean,
) {
  return seasons.filter(({ showId, ts }) => ts >= window.start && ts < window.end && includeShow(showId));
}

// A title is a movie or a completed season, never a single episode. Time sums every watched runtime.
function periodTotals(rows: DatedRow[], seasons: CompletedSeason[]): InsightsPeriodTotals {
  const movieIds = new Set<string>();
  let runtimeMinutes = 0;
  for (const { row } of rows) {
    if (row.media_items?.type !== "show") movieIds.add(row.media_id);
    runtimeMinutes += mediaWatchRuntime(row);
  }
  return { titleCount: movieIds.size + seasons.length, runtimeMinutes };
}

function ratedTitles(rows: DatedRow[], ratings: Map<string, number>) {
  const latest = new Map<string, { ts: number; title: string }>();
  for (const { row, ts } of rows) {
    if (!ratings.has(row.media_id)) continue;
    const existing = latest.get(row.media_id);
    if (!existing || ts > existing.ts) {
      latest.set(row.media_id, { ts, title: row.media_items?.title?.trim() || "Untitled" });
    }
  }
  return Array.from(latest, ([mediaId, { ts, title }]) => ({
    ts,
    title: { mediaId, title, rating: ratings.get(mediaId) as number },
  }));
}

function averageRating(rated: Array<{ title: InsightsRatedTitle }>) {
  if (rated.length === 0) return null;
  const sum = rated.reduce((total, item) => total + item.title.rating, 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

// Ties go to the most recently watched title. The lowest is hidden when it is the highest.
function pickExtremes(rated: Array<{ ts: number; title: InsightsRatedTitle }>) {
  if (rated.length === 0) return { highestRated: null, lowestRated: null };
  const highest = rated.reduce((best, item) =>
    item.title.rating > best.title.rating || (item.title.rating === best.title.rating && item.ts > best.ts)
      ? item
      : best,
  );
  const lowest = rated.reduce((best, item) =>
    item.title.rating < best.title.rating || (item.title.rating === best.title.rating && item.ts > best.ts)
      ? item
      : best,
  );
  return {
    highestRated: highest.title,
    lowestRated: lowest.title.mediaId === highest.title.mediaId ? null : lowest.title,
  };
}

// Months and weekdays rank by time watched, not by how many titles were watched.
function buildHabits(rows: DatedRow[]): Insights["habits"] {
  const monthMinutes = new Map<string, number>();
  const weekdayMinutes = new Map<number, number>();
  const decadeTitles = new Map<number, Set<string>>();

  for (const { row, ts } of rows) {
    const date = new Date(ts);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const minutes = mediaWatchRuntime(row);
    monthMinutes.set(month, (monthMinutes.get(month) ?? 0) + minutes);
    weekdayMinutes.set(date.getUTCDay(), (weekdayMinutes.get(date.getUTCDay()) ?? 0) + minutes);

    const releaseYear = row.media_items?.release_year;
    if (typeof releaseYear === "number") {
      addToSetMap(decadeTitles, Math.floor(releaseYear / 10) * 10, row.media_id);
    }
  }

  const months: InsightsMonth[] = Array.from(monthMinutes, ([key, runtimeMinutes]) => ({
    key,
    label: `${monthLabels[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`,
    runtimeMinutes,
  }));
  // Months sort oldest-first, so a later month wins a tie.
  months.sort((a, b) => a.key.localeCompare(b.key));
  const busiestMonth = months.reduce<InsightsMonth | null>(
    (best, month) => (!best || month.runtimeMinutes >= best.runtimeMinutes ? month : best),
    null,
  );
  const quietestMonth = months.reduce<InsightsMonth | null>(
    (best, month) => (!best || month.runtimeMinutes <= best.runtimeMinutes ? month : best),
    null,
  );

  const topWeekday = topKey(weekdayMinutes, "first");
  const topDecade = topKey(new Map(Array.from(decadeTitles, ([decade, ids]) => [decade, ids.size])), "last");

  return {
    busiestMonth,
    quietestMonth: quietestMonth && quietestMonth.key !== busiestMonth?.key ? quietestMonth : null,
    topWeekday: topWeekday === null ? null : weekdayLabels[topWeekday],
    topDecade: topDecade === null ? null : `${topDecade}s`,
  };
}

function addToSetMap<K>(map: Map<K, Set<string>>, key: K, value: string) {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
}

function topKey(map: Map<number, number>, tie: "first" | "last"): number | null {
  let best: number | null = null;
  for (const key of Array.from(map.keys()).sort((a, b) => a - b)) {
    const value = map.get(key) ?? 0;
    const bestValue = best === null ? -1 : (map.get(best) ?? 0);
    if (value > bestValue || (value === bestValue && tie === "last")) best = key;
  }
  return best;
}

// "Last month" is the previous calendar month, compared with the month before it.
export function buildCompanionMonth({
  watchRows,
  seasonEpisodes,
  tagRows,
  ratingRows,
  companionTag,
  now = new Date(),
}: {
  watchRows: MediaStatsWatchRow[];
  seasonEpisodes: SeasonEpisodeRow[];
  tagRows: MediaStatsTagRow[];
  ratingRows: MediaStatsRatingRow[];
  companionTag: string;
  now?: Date;
}): CompanionMonth {
  const companionIds = companionMediaIds(tagRows, companionTag);
  const datedRows = datedWatchRows(watchRows);
  const seasons = completedSeasons(datedRows, seasonEpisodes);
  const ratings = new Map<string, number>();
  for (const row of ratingRows) {
    if (row.personal_rating !== null) ratings.set(row.media_id, row.personal_rating);
  }

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const last = { start: Date.UTC(year, month - 1, 1), end: Date.UTC(year, month, 1) };
  const previous = { start: Date.UTC(year, month - 2, 1), end: last.start };

  const lastRows = rowsInWindow(datedRows, last);
  const withLast = lastRows.filter(({ row }) => companionIds.has(row.media_id));
  const withPrevious = rowsInWindow(datedRows, previous).filter(({ row }) => companionIds.has(row.media_id));

  const isCompanion = (id: string) => companionIds.has(id);
  const withTotals = periodTotals(withLast, seasonsIn(seasons, last, isCompanion));
  const allMinutes = lastRows.reduce((total, { row }) => total + mediaWatchRuntime(row), 0);
  const weekdayMinutes = new Map<number, number>();
  for (const { row, ts } of withLast) {
    const day = new Date(ts).getUTCDay();
    weekdayMinutes.set(day, (weekdayMinutes.get(day) ?? 0) + mediaWatchRuntime(row));
  }
  const topWeekday = topKey(weekdayMinutes, "first");

  return {
    label: monthName(last.start),
    withCompanion: withTotals,
    withCompanionPreviousMonth: periodTotals(withPrevious, seasonsIn(seasons, previous, isCompanion)),
    previousMonthLabel: monthName(previous.start),
    sharePercent: allMinutes > 0 ? Math.round((withTotals.runtimeMinutes / allMinutes) * 1000) / 10 : null,
    highestRated: pickExtremes(ratedTitles(withLast, ratings)).highestRated,
    topWeekday: topWeekday === null ? null : weekdayLabels[topWeekday],
  };
}

function monthName(ts: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(ts));
}
