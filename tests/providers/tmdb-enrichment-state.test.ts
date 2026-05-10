import { describe, expect, it } from "vitest";

import {
  needsTmdbMetadataEnrichment,
  normalizeTmdbBackfillLimit,
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

  it("bounds manual backfill batch size", () => {
    expect(normalizeTmdbBackfillLimit(null)).toBe(20);
    expect(normalizeTmdbBackfillLimit(0)).toBe(1);
    expect(normalizeTmdbBackfillLimit(500)).toBe(50);
  });
});
