// The rating sheet offers 3-10; anything lower is not offered for new ratings.
export const MIN_SELECTABLE_RATING = 3;
export const MAX_RATING = 10;

export const SELECTABLE_RATINGS = Array.from(
  { length: MAX_RATING - MIN_SELECTABLE_RATING + 1 },
  (_, i) => MIN_SELECTABLE_RATING + i,
);

export const RATING_LABELS: Record<number, string> = {
  3: "Poor",
  4: "Below Average",
  5: "Average",
  6: "Fine",
  7: "Good",
  8: "Great",
  9: "Excellent",
  10: "Masterpiece",
};

// Fixed word that follows a random reference title, e.g. "Entourage energy".
export const RATING_REFERENCE_WORDS: Record<number, string> = {
  3: "level",
  4: "vibes",
  5: "energy",
  6: "tier",
  7: "caliber",
  8: "territory",
  9: "class",
  10: "peak",
};
