import { describe, expect, it } from "vitest";

import { pickRatingReferences } from "@/lib/db/queries/rating-references-transforms";

const row = (id: string, rating: number | string | null, title: string | null = id) => ({
  media_id: id,
  personal_rating: rating,
  media_items: title === null ? null : { title },
});

describe("pickRatingReferences", () => {
  it("picks one title per rating from 3 to 10 and ignores lower or missing ratings", () => {
    const picks = pickRatingReferences(
      [row("a", 3), row("b", "7.0"), row("c", 2), row("d", null), row("e", 10)],
      new Set(),
      () => 0,
    );

    expect(picks).toEqual({ 3: "a", 7: "b", 10: "e" });
  });

  it("never offers an excluded title and leaves a rating empty when nothing else is there", () => {
    const picks = pickRatingReferences([row("a", 5), row("b", 6)], new Set(["a"]), () => 0);

    expect(picks).toEqual({ 6: "b" });
  });

  it("chooses randomly among titles at the same rating", () => {
    const rows = [row("a", 8), row("b", 8), row("c", 8)];

    expect(pickRatingReferences(rows, new Set(), () => 0)[8]).toBe("a");
    expect(pickRatingReferences(rows, new Set(), () => 0.99)[8]).toBe("c");
  });
});
