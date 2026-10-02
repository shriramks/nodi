import { describe, expect, it } from "vitest";

import { interleave, parseDiscoverRail, parseDiscoverType } from "@/lib/media/discover-rails";

describe("discover rails", () => {
  it("alternates two lists and keeps the longer tail", () => {
    expect(interleave<number | string>([1, 2, 3], ["a"])).toEqual([1, "a", 2, 3]);
    expect(interleave<string>([], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("parses rails and falls back for unknown values", () => {
    expect(parseDiscoverRail("popular")).toBe("popular");
    expect(parseDiscoverRail("nope")).toBeNull();
    expect(parseDiscoverType("show")).toBe("show");
    expect(parseDiscoverType(null)).toBe("all");
  });
});
