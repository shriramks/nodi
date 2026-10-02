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

export function buildInsights({
  watchRows,
  tagRows,
  ratingRows,
  companionTag,
  now = new Date(),
}: {
  watchRows: MediaStatsWatchRow[];
  tagRows: MediaStatsTagRow[];
  ratingRows: MediaStatsRatingRow[];
  companionTag: string;
  now?: Date;
}): Insights {
  const companionIds = companionMediaIds(tagRows, companionTag);
  const datedRows = datedWatchRows(watchRows);
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

  const withTotals = periodTotals(withThisYear);
  const withoutTotals = periodTotals(withoutThisYear);
  const totalMinutes = withTotals.runtimeMinutes + withoutTotals.runtimeMinutes;
  const rated = ratedTitles(withThisYear, ratings);
  const { highestRated, lowestRated } = pickExtremes(rated);

  return {
    hasCompanionData: companionIds.size > 0 && datedRows.some(({ row }) => companionIds.has(row.media_id)),
    habits: buildHabits(datedRows.filter(({ row }) => companionIds.has(row.media_id))),
    thisYear: {
      year,
      withCompanion: withTotals,
      withCompanionLastYear: periodTotals(withLastYear),
      withoutCompanion: withoutTotals,
      companionSharePercent:
        totalMinutes > 0 ? Math.round((withTotals.runtimeMinutes / totalMinutes) * 1000) / 10 : null,
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

// A title is a movie or a show, never an episode. Time sums every watched runtime.
function periodTotals(rows: DatedRow[]): InsightsPeriodTotals {
  const mediaIds = new Set<string>();
  let runtimeMinutes = 0;
  for (const { row } of rows) {
    mediaIds.add(row.media_id);
    runtimeMinutes += mediaWatchRuntime(row);
  }
  return { titleCount: mediaIds.size, runtimeMinutes };
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

function buildHabits(rows: DatedRow[]): Insights["habits"] {
  const monthTitles = new Map<string, Set<string>>();
  const weekdayDays = new Map<number, Set<string>>();
  const decadeTitles = new Map<number, Set<string>>();

  for (const { row, ts } of rows) {
    const date = new Date(ts);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    addToSetMap(monthTitles, month, row.media_id);
    // One media per calendar day, so binging five episodes counts once.
    addToSetMap(weekdayDays, date.getUTCDay(), `${row.media_id}:${date.toISOString().slice(0, 10)}`);

    const releaseYear = row.media_items?.release_year;
    if (typeof releaseYear === "number") {
      addToSetMap(decadeTitles, Math.floor(releaseYear / 10) * 10, row.media_id);
    }
  }

  const months: InsightsMonth[] = Array.from(monthTitles, ([key, ids]) => ({
    key,
    label: `${monthLabels[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`,
    titleCount: ids.size,
  }));
  // Months sort oldest-first, so a later month wins a tie.
  months.sort((a, b) => a.key.localeCompare(b.key));
  const busiestMonth = months.reduce<InsightsMonth | null>(
    (best, month) => (!best || month.titleCount >= best.titleCount ? month : best),
    null,
  );
  const quietestMonth = months.reduce<InsightsMonth | null>(
    (best, month) => (!best || month.titleCount <= best.titleCount ? month : best),
    null,
  );

  const topWeekday = topKey(weekdayDays, "first");
  const topDecade = topKey(decadeTitles, "last");

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

function topKey(map: Map<number, Set<string>>, tie: "first" | "last"): number | null {
  let best: number | null = null;
  for (const key of Array.from(map.keys()).sort((a, b) => a - b)) {
    const size = map.get(key)?.size ?? 0;
    const bestSize = best === null ? -1 : (map.get(best)?.size ?? 0);
    if (size > bestSize || (size === bestSize && tie === "last")) best = key;
  }
  return best;
}

// "Last month" is the previous calendar month, compared with the month before it.
export function buildCompanionMonth({
  watchRows,
  tagRows,
  ratingRows,
  companionTag,
  now = new Date(),
}: {
  watchRows: MediaStatsWatchRow[];
  tagRows: MediaStatsTagRow[];
  ratingRows: MediaStatsRatingRow[];
  companionTag: string;
  now?: Date;
}): CompanionMonth {
  const companionIds = companionMediaIds(tagRows, companionTag);
  const datedRows = datedWatchRows(watchRows);
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

  const withTotals = periodTotals(withLast);
  const allMinutes = periodTotals(lastRows).runtimeMinutes;
  const weekdayDays = new Map<number, Set<string>>();
  for (const { row, ts } of withLast) {
    const date = new Date(ts);
    addToSetMap(weekdayDays, date.getUTCDay(), `${row.media_id}:${date.toISOString().slice(0, 10)}`);
  }
  const topWeekday = topKey(weekdayDays, "first");

  return {
    label: monthName(last.start),
    withCompanion: withTotals,
    withCompanionPreviousMonth: periodTotals(withPrevious),
    previousMonthLabel: monthName(previous.start),
    sharePercent: allMinutes > 0 ? Math.round((withTotals.runtimeMinutes / allMinutes) * 1000) / 10 : null,
    highestRated: pickExtremes(ratedTitles(withLast, ratings)).highestRated,
    topWeekday: topWeekday === null ? null : weekdayLabels[topWeekday],
  };
}

function monthName(ts: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(ts));
}
