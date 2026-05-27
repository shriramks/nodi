type TmdbEnrichmentState = {
  tmdb_enriched_at: string | null;
  tmdb_id: number;
};

export type EstimatedTmdbBackfillCandidate = {
  estimatedTmdbCallCount: number;
};

export function needsTmdbMetadataEnrichment(movie: TmdbEnrichmentState) {
  return Number.isInteger(movie.tmdb_id) && movie.tmdb_id > 0 && !movie.tmdb_enriched_at;
}

export function normalizeTmdbBackfillCallBudget(value: number | null | undefined, fallback = 20) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 1), 50);
}

export const estimateTmdbMovieBackfillCallCount = () => 2;

export function estimateTmdbShowBackfillCallCount(watchedSeasonCount: number) {
  if (!Number.isInteger(watchedSeasonCount) || watchedSeasonCount < 0) {
    return 1;
  }

  return 1 + watchedSeasonCount;
}

export function normalizeTmdbBackfillLimit(value: number | null | undefined, fallback = 20) {
  return normalizeTmdbBackfillCallBudget(value, fallback);
}

export function selectTmdbBackfillCandidatesWithinBudget<
  Candidate extends EstimatedTmdbBackfillCandidate,
>(candidates: Candidate[], callBudget: number) {
  const selected: Candidate[] = [];
  let remainingBudget = Math.max(callBudget, 1);

  for (const candidate of candidates) {
    const estimatedCallCount = Math.max(candidate.estimatedTmdbCallCount, 1);

    if (estimatedCallCount > remainingBudget) {
      if (selected.length === 0) {
        selected.push(candidate);
      }

      break;
    }

    selected.push(candidate);
    remainingBudget -= estimatedCallCount;
  }

  return selected;
}
