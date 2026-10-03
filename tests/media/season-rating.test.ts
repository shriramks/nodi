import { describe, expect, it } from "vitest";

import { computeShowRating, isValidSeasonRating } from "@/lib/media/season-rating";

describe("computeShowRating", () => {
  it("returns null when no season is rated", () => {
    expect(computeShowRating({})).toBeNull();
  });

  it("rounds the average of rated seasons up", () => {
    expect(computeShowRating({ "1": 9, "2": 8, "3": 8, "4": 8 })).toBe(9);
    expect(computeShowRating({ "1": 9, "2": 8 })).toBe(9);
    expect(computeShowRating({ "1": 7, "2": 7 })).toBe(7);
  });

  it("works with a single rated season", () => {
    expect(computeShowRating({ "3": 5 })).toBe(5);
  });
});

describe("isValidSeasonRating", () => {
  it("accepts whole numbers 3-10 only", () => {
    expect(isValidSeasonRating(3)).toBe(true);
    expect(isValidSeasonRating(10)).toBe(true);
    expect(isValidSeasonRating(2)).toBe(false);
    expect(isValidSeasonRating(11)).toBe(false);
    expect(isValidSeasonRating(7.5)).toBe(false);
  });
});
