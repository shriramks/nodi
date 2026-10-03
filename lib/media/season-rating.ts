import { MAX_RATING, MIN_SELECTABLE_RATING } from "@/lib/media/rating-scale";

export type SeasonRatings = Record<string, number>;

// Show rating derived from rated seasons: rounded-up average. Null when no season is rated.
export function computeShowRating(seasonRatings: SeasonRatings): number | null {
  const values = Object.values(seasonRatings);
  if (values.length === 0) return null;
  return Math.ceil(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function isValidSeasonRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= MIN_SELECTABLE_RATING && rating <= MAX_RATING;
}
