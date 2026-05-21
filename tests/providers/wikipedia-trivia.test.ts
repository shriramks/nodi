import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/fetch", () => ({
  fetchJson: fetchJsonMock,
}));

import {
  getMovieWikipediaTrivia,
  getPersonWikipediaTrivia,
} from "@/lib/providers/wikipedia/trivia";

function sparqlResponse(bindings: unknown[]) {
  return {
    results: {
      bindings,
    },
  };
}

function wikidataItem(qid: string) {
  return {
    type: "uri",
    value: `https://www.wikidata.org/entity/${qid}`,
  };
}

function literal(value: string) {
  return {
    type: "literal",
    value,
  };
}

function requestUrl(input: RequestInfo | URL) {
  return String(input);
}

function sparqlQuery(url: string) {
  return new URL(url).searchParams.get("query") ?? "";
}

describe("Wikipedia trivia matching", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it("falls back to Wikidata search when movie IDs and exact title matching miss", async () => {
    fetchJsonMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);

      if (url.startsWith("https://www.wikidata.org/w/api.php")) {
        expect(new URL(url).searchParams.get("search")).toBe("Alternate Movie Title");
        return Promise.resolve({ search: [{ id: "Q100" }] });
      }

      if (url.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
        return Promise.resolve({
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Original_Movie" } },
          extract: "Original Movie is a 1989 film with a localized title.",
        });
      }

      const query = sparqlQuery(url);

      if (query.includes("VALUES ?item { wd:Q100 }")) {
        return Promise.resolve(
          sparqlResponse([
            {
              article: literal("https://en.wikipedia.org/wiki/Original_Movie"),
              item: wikidataItem("Q100"),
              itemLabel: literal("Original Movie"),
              publicationDate: literal("1989-07-29T00:00:00Z"),
            },
          ]),
        );
      }

      return Promise.resolve(sparqlResponse([]));
    });

    const trivia = await getMovieWikipediaTrivia({
      imdbId: "tt001",
      releaseYear: 1989,
      title: "Alternate Movie Title",
      tmdbId: 123,
    });

    expect(trivia).toEqual([
      {
        sourceLabel: "Wikipedia/Wikidata",
        sourceUrl: "https://en.wikipedia.org/wiki/Original_Movie",
        text: "Original Movie is a 1989 film with a localized title.",
      },
    ]);
  });

  it("falls back to Wikidata search when person IDs and exact name matching miss", async () => {
    fetchJsonMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);

      if (url.startsWith("https://www.wikidata.org/w/api.php")) {
        expect(new URL(url).searchParams.get("search")).toBe("Stage Name");
        return Promise.resolve({ search: [{ id: "Q200" }] });
      }

      if (url.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
        return Promise.resolve({
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Actor_Name" } },
          extract: "Actor Name is a performer known for film work.",
        });
      }

      const query = sparqlQuery(url);

      if (query.includes("VALUES ?item { wd:Q200 }")) {
        return Promise.resolve(
          sparqlResponse([
            {
              article: literal("https://en.wikipedia.org/wiki/Actor_Name"),
              birthDate: literal("1975-02-03T00:00:00Z"),
              item: wikidataItem("Q200"),
              itemLabel: literal("Actor Name"),
            },
          ]),
        );
      }

      return Promise.resolve(sparqlResponse([]));
    });

    const trivia = await getPersonWikipediaTrivia({
      birthday: "1975-02-03",
      imdbId: "nm001",
      name: "Stage Name",
      tmdbPersonId: 456,
    });

    expect(trivia).toEqual([
      {
        sourceLabel: "Wikipedia/Wikidata",
        sourceUrl: "https://en.wikipedia.org/wiki/Actor_Name",
        text: "Actor Name is a performer known for film work.",
      },
    ]);
  });
});
