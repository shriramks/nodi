import type { MediaSearchResult } from "@/lib/providers/tmdb/adapters";

// Saved titles open their local detail; everything else opens the remote TMDB detail first.
export function searchResultHref(result: MediaSearchResult) {
  if (result.mediaType === "movie" && result.localMovieId) {
    return `/movie/${result.localMovieId}`;
  }

  if (result.mediaType === "show" && result.localMediaId) {
    return `/show/${result.localMediaId}/episodes`;
  }

  return result.detailUrl;
}
