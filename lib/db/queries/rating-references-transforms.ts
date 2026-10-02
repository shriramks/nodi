import { SELECTABLE_RATINGS } from "@/lib/media/rating-scale";

export type RatedTitleRow = {
  media_id: string;
  personal_rating: number | string | null;
  media_items: { title: string } | null;
};

// One random title per selectable rating, never one of the excluded (currently-being-rated) titles.
// A rating with no other titles is simply absent.
export function pickRatingReferences(
  rows: RatedTitleRow[],
  excludeIds: ReadonlySet<string>,
  random: () => number = Math.random,
): Record<number, string> {
  const byRating = new Map<number, string[]>();
  for (const row of rows) {
    if (!row.media_items || excludeIds.has(row.media_id)) continue;
    const rating = Number(row.personal_rating);
    if (!SELECTABLE_RATINGS.includes(rating)) continue;
    const titles = byRating.get(rating) ?? [];
    titles.push(row.media_items.title);
    byRating.set(rating, titles);
  }

  const picks: Record<number, string> = {};
  for (const [rating, titles] of byRating) {
    picks[rating] = titles[Math.floor(random() * titles.length)];
  }
  return picks;
}
