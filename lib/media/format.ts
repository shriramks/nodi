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

export function formatRuntime(minutes: number) {
  if (minutes <= 0) return "0m";
  const days = Math.floor(minutes / 1440);
  const dayHours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = Math.floor(minutes % 60);
  const hours = Math.floor(minutes / 60);

  if (days > 0) {
    if (dayHours > 0 && remainingMinutes > 0) return `${days}d ${dayHours}h ${remainingMinutes}m`;
    if (dayHours > 0) return `${days}d ${dayHours}h`;
    if (remainingMinutes > 0) return `${days}d ${remainingMinutes}m`;
    return `${days}d`;
  }
  if (hours > 0) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  return `${remainingMinutes}m`;
}

export function formatPercent(value: number | null) {
  return value === null ? "0%" : `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

export function signed(value: number) {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `-${Math.abs(value)}`;
}

export function signedRuntime(minutes: number) {
  if (minutes === 0) return "0m";
  return `${minutes > 0 ? "+" : "-"}${formatRuntime(Math.abs(minutes))}`;
}

export function companionLabel(tagName: string) {
  return tagName.charAt(0).toUpperCase() + tagName.slice(1);
}
