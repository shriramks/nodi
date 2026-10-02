export const DISCOVER_RAILS = ["trending", "anticipated", "popular"] as const;
export type DiscoverRail = (typeof DISCOVER_RAILS)[number];

export const DISCOVER_TYPES = ["all", "movie", "show"] as const;
export type DiscoverType = (typeof DISCOVER_TYPES)[number];

export const DISCOVER_RAIL_LABELS: Record<DiscoverRail, string> = {
  trending: "Trending",
  anticipated: "Anticipated",
  popular: "Popular",
};

// Titles per rail on the Discover screen; the full-list page pages through TMDB instead.
export const DISCOVER_RAIL_SIZE = 10;

export function parseDiscoverRail(value: string | null | undefined): DiscoverRail | null {
  return DISCOVER_RAILS.find((rail) => rail === value) ?? null;
}

export function parseDiscoverType(value: string | null | undefined): DiscoverType {
  return DISCOVER_TYPES.find((type) => type === value) ?? "all";
}

// Alternates two lists (a1, b1, a2, b2, ...) so a mixed rail never shows a run of one type.
export function interleave<T>(first: T[], second: T[]): T[] {
  const merged: T[] = [];

  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    if (index < first.length) merged.push(first[index]);
    if (index < second.length) merged.push(second[index]);
  }

  return merged;
}
