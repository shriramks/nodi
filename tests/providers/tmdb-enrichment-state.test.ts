import { describe, expect, it } from "vitest";

import {
  estimateTmdbMovieBackfillCallCount,
  estimateTmdbShowBackfillCallCount,
  needsTmdbMetadataEnrichment,
  normalizeTmdbBackfillCallBudget,
  normalizeTmdbBackfillLimit,
  selectTmdbBackfillCandidatesWithinBudget,
} from "@/lib/providers/tmdb/enrichment-state";

describe("TMDB enrichment state", () => {
  it("selects valid TMDB movies without an enrichment marker", () => {
    expect(
      needsTmdbMetadataEnrichment({
        tmdb_enriched_at: null,
        tmdb_id: 437,
      }),
    ).toBe(true);
  });

  it("skips invalid ids and already enriched movies", () => {
    expect(
      needsTmdbMetadataEnrichment({
        tmdb_enriched_at: "2026-05-10T00:00:00.000Z",
        tmdb_id: 437,
      }),
    ).toBe(false);
    expect(
      needsTmdbMetadataEnrichment({
        tmdb_enriched_at: null,
        tmdb_id: 0,
      }),
    ).toBe(false);
  });

  it("bounds manual backfill call budget", () => {
    expect(normalizeTmdbBackfillCallBudget(null)).toBe(20);
    expect(normalizeTmdbBackfillCallBudget(0)).toBe(1);
    expect(normalizeTmdbBackfillCallBudget(500)).toBe(50);
    expect(normalizeTmdbBackfillLimit(500)).toBe(50);
  });

  it("estimates TMDB backfill call counts by media type", () => {
    expect(estimateTmdbMovieBackfillCallCount()).toBe(2);
    expect(estimateTmdbShowBackfillCallCount(0)).toBe(1);
    expect(estimateTmdbShowBackfillCallCount(3)).toBe(4);
    expect(estimateTmdbShowBackfillCallCount(-1)).toBe(1);
  });

  it("selects prioritized candidates within the TMDB call budget", () => {
    const candidates = [
      { id: "watched-show", estimatedTmdbCallCount: 4 },
      { id: "movie", estimatedTmdbCallCount: 2 },
      { id: "later-show", estimatedTmdbCallCount: 1 },
    ];

    expect(selectTmdbBackfillCandidatesWithinBudget(candidates, 6)).toEqual([
      candidates[0],
      candidates[1],
    ]);
  });

  it("keeps progress moving when the top candidate exceeds the call budget", () => {
    const candidates = [
      { id: "large-show", estimatedTmdbCallCount: 12 },
      { id: "movie", estimatedTmdbCallCount: 2 },
    ];

    expect(selectTmdbBackfillCandidatesWithinBudget(candidates, 5)).toEqual([
      candidates[0],
    ]);
  });
});
