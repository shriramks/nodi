import { describe, expect, it } from "vitest";

import {
  toRelevantPersonMovies,
  topPersonCreditTitle,
} from "@/lib/providers/tmdb/person-credits";
import type { TmdbPersonCombinedCredits } from "@/lib/providers/tmdb/client";

describe("TMDB person movie credits", () => {
  it("filters out TV credits and ranks movie work by relevance", () => {
    const credits: TmdbPersonCombinedCredits = {
      id: 1,
      cast: [
        {
          id: 10,
          media_type: "tv",
          name: "Popular Show",
          popularity: 500,
          vote_count: 9000,
        },
        {
          id: 20,
          media_type: "movie",
          title: "Lead Movie",
          character: "Lead",
          order: 0,
          popularity: 20,
          poster_path: "/lead.jpg",
          release_date: "1999-01-01",
          vote_average: 7,
          vote_count: 1000,
        },
        {
          id: 30,
          media_type: "movie",
          title: "Tiny Cameo Hit",
          character: "Cameo",
          order: 40,
          popularity: 25,
          poster_path: "/cameo.jpg",
          vote_average: 7,
          vote_count: 1000,
        },
      ],
    };

    expect(toRelevantPersonMovies(credits).map((credit) => credit.title)).toEqual([
      "Lead Movie",
      "Tiny Cameo Hit",
    ]);
  });

  it("pins the source movie from the cast link when it exists in credits", () => {
    const credits: TmdbPersonCombinedCredits = {
      id: 1,
      cast: [
        {
          id: 20,
          media_type: "movie",
          title: "Broad Hit",
          popularity: 250,
          poster_path: "/hit.jpg",
        },
        {
          id: 30,
          media_type: "movie",
          title: "Movie From Current Page",
          popularity: 1,
          poster_path: "/source.jpg",
        },
      ],
    };

    expect(toRelevantPersonMovies(credits, { sourceMovieId: 30 }).map((credit) => credit.id)).toEqual([
      30,
      20,
    ]);
  });
});

describe("top person credit title", () => {
  it("ranks a defining TV lead above a trending movie with a minor role", () => {
    const credits: TmdbPersonCombinedCredits = {
      id: 1,
      cast: [
        {
          id: 10,
          media_type: "tv",
          name: "Lost",
          character: "Jack Shephard",
          order: 0,
          episode_count: 121,
          popularity: 80,
          vote_average: 8,
          vote_count: 9000,
        },
        {
          // Currently trending and well-voted, but a bit part — must not win.
          id: 20,
          media_type: "movie",
          title: "Trending Blockbuster",
          order: 18,
          popularity: 900,
          vote_average: 7,
          vote_count: 12000,
        },
      ],
    };

    expect(topPersonCreditTitle(credits)).toBe("Lost");
  });

  it("ranks a one-episode guest spot below a leading film role", () => {
    const credits: TmdbPersonCombinedCredits = {
      id: 1,
      cast: [
        {
          id: 10,
          media_type: "tv",
          name: "Mega Show",
          order: 20,
          episode_count: 1,
          popularity: 50,
          vote_count: 30000,
        },
        {
          id: 20,
          media_type: "movie",
          title: "Lead Film",
          order: 0,
          popularity: 20,
          vote_count: 2500,
        },
      ],
    };

    expect(topPersonCreditTitle(credits)).toBe("Lead Film");
  });

  it("returns null when there are no usable credits", () => {
    expect(topPersonCreditTitle({ id: 1, cast: [], crew: [] })).toBeNull();
  });
});
