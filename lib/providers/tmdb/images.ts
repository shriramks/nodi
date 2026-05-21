export type TmdbImageSize = "w185" | "w342" | "w780";

export function tmdbImageUrl(path: string, size: TmdbImageSize) {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
