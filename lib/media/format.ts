export type TmdbRating = { value: number; voteCount: number | null };

export function getTmdbRating(media: {
  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
}): TmdbRating | null {
  if (media.tmdb_vote_average !== null && media.tmdb_vote_average !== undefined) {
    return {
      value: media.tmdb_vote_average,
      voteCount: media.tmdb_vote_count ?? null,
    };
  }
  return null;
}

export function languageDisplayName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
