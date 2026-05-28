type SeasonLike = {
  seasonNumber: number;
  episodes: { watchActivity?: unknown[] }[];
};

export function countShowProgress(seasons: SeasonLike[]): { watched: number; total: number } {
  const nonSpecial = seasons.filter((s) => s.seasonNumber !== 0);
  return {
    watched: nonSpecial.reduce(
      (count, season) =>
        count + season.episodes.filter((ep) => (ep.watchActivity?.length ?? 0) > 0).length,
      0,
    ),
    total: nonSpecial.reduce((count, season) => count + season.episodes.length, 0),
  };
}
