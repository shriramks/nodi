type TmdbEnrichmentState = {
  tmdb_enriched_at: string | null;
  tmdb_id: number;
};

export function needsTmdbMetadataEnrichment(movie: TmdbEnrichmentState) {
  return Number.isInteger(movie.tmdb_id) && movie.tmdb_id > 0 && !movie.tmdb_enriched_at;
}

export function normalizeTmdbBackfillLimit(value: number | null | undefined, fallback = 20) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 1), 50);
}
