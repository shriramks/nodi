import { throwDatabaseError } from "@/lib/db/errors";
import type { MediaStatus, MovieStatus } from "@/lib/db/types";
import type {
  LocalMediaSearchState,
  LocalMovieSearchState,
} from "@/lib/providers/tmdb/adapters";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LocalMovieRow = {
  media_id: string | null;
  provider_id: string;
};

type LocalShowMappingRow = {
  media_id: string | null;
  provider_id: string;
};

type UserMediaStateRow = {
  media_id: string;
  status: MediaStatus;
  personal_rating: number | null;
};

export async function loadLocalMovieState(tmdbIds: number[], userId: string) {
  const uniqueTmdbIds = Array.from(new Set(tmdbIds));

  if (uniqueTmdbIds.length === 0) {
    return new Map<number, LocalMovieSearchState>();
  }

  const supabase = await createSupabaseServerClient();
  const { data: movies, error: moviesError } = await supabase
    .from("media_provider_mappings")
    .select("media_id, provider_id")
    .eq("provider", "tmdb")
    .eq("provider_media_type", "movie")
    .in("provider_id", uniqueTmdbIds.map(String));

  if (moviesError) {
    throwDatabaseError("Failed to load local movie matches.", moviesError);
  }

  const movieRows = ((movies ?? []) as LocalMovieRow[]).filter((movie) => movie.media_id);

  if (movieRows.length === 0) {
    return new Map<number, LocalMovieSearchState>();
  }

  const localStateByTmdbId = new Map<number, LocalMovieSearchState>();
  const tmdbIdByMediaId = new Map(
    movieRows.map((movie) => [movie.media_id as string, Number(movie.provider_id)]),
  );
  const { data: userMovies, error: userMoviesError } = await supabase
    .from("user_media")
    .select("media_id, status, personal_rating")
    .eq("user_id", userId)
    .in("media_id", Array.from(tmdbIdByMediaId.keys()));

  if (userMoviesError) {
    throwDatabaseError("Failed to load local user movie state.", userMoviesError);
  }

  ((userMovies ?? []) as UserMediaStateRow[]).forEach((userMovie) => {
    const tmdbId = tmdbIdByMediaId.get(userMovie.media_id);
    const currentStatus = mediaMovieStatusToSearchStatus(userMovie.status);

    if (!tmdbId || !currentStatus) {
      return;
    }

    localStateByTmdbId.set(tmdbId, {
      localMovieId: userMovie.media_id,
      currentStatus,
      personalRating: userMovie.personal_rating,
    });
  });

  return localStateByTmdbId;
}

function mediaMovieStatusToSearchStatus(status: MediaStatus): MovieStatus | null {
  if (status === "done") {
    return "watched";
  }

  if (status === "wishlist") {
    return "to_watch";
  }

  return null;
}

export async function loadLocalShowState(tmdbIds: number[], userId: string) {
  const uniqueTmdbIds = Array.from(new Set(tmdbIds));

  if (uniqueTmdbIds.length === 0) {
    return new Map<number, LocalMediaSearchState>();
  }

  const supabase = await createSupabaseServerClient();
  const { data: mappings, error: mappingsError } = await supabase
    .from("media_provider_mappings")
    .select("media_id, provider_id")
    .eq("provider", "tmdb")
    .eq("provider_media_type", "show")
    .in("provider_id", uniqueTmdbIds.map(String));

  if (mappingsError) {
    throwDatabaseError("Failed to load local show matches.", mappingsError);
  }

  const mappingRows = ((mappings ?? []) as LocalShowMappingRow[]).filter(
    (mapping) => mapping.media_id,
  );

  if (mappingRows.length === 0) {
    return new Map<number, LocalMediaSearchState>();
  }

  const tmdbIdByMediaId = new Map(
    mappingRows.map((mapping) => [mapping.media_id as string, Number(mapping.provider_id)]),
  );
  const { data: userMedia, error: userMediaError } = await supabase
    .from("user_media")
    .select("media_id, status, personal_rating")
    .eq("user_id", userId)
    .in("media_id", Array.from(tmdbIdByMediaId.keys()));

  if (userMediaError) {
    throwDatabaseError("Failed to load local user show state.", userMediaError);
  }

  const localStateByTmdbId = new Map<number, LocalMediaSearchState>();
  ((userMedia ?? []) as UserMediaStateRow[]).forEach((row) => {
    const tmdbId = tmdbIdByMediaId.get(row.media_id);

    if (!tmdbId) {
      return;
    }

    localStateByTmdbId.set(tmdbId, {
      localMediaId: row.media_id,
      currentStatus: row.status,
      personalRating: row.personal_rating,
    });
  });

  return localStateByTmdbId;
}
