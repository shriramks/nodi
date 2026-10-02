import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { loadLocalMovieState, loadLocalShowState } from "@/lib/db/queries/search-local-state";
import { isAppError } from "@/lib/errors";
import {
  DISCOVER_RAILS,
  DISCOVER_RAIL_SIZE,
  interleave,
  parseDiscoverRail,
  parseDiscoverType,
  type DiscoverRail,
  type DiscoverType,
} from "@/lib/media/discover-rails";
import { checkRateLimit, rateLimitResponse, requestRateLimitKey } from "@/lib/rate-limit";
import {
  type MediaSearchResult,
  toMovieSearchResult,
  toTvSearchResult,
} from "@/lib/providers/tmdb/adapters";
import {
  getTmdbPopularMovies,
  getTmdbPopularTv,
  getTmdbTrending,
  getTmdbUpcomingMovies,
  getTmdbUpcomingTv,
  type TmdbMovieSearchResult,
  type TmdbTvSearchResult,
} from "@/lib/providers/tmdb/client";

const maximumTmdbPage = 500;

type RailItem =
  | { kind: "movie"; data: TmdbMovieSearchResult }
  | { kind: "show"; data: TmdbTvSearchResult };

type RailPage = {
  items: RailItem[];
  totalPages: number;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to discover titles." },
        { status: 401 },
      );
    }

    const retryAfter = checkRateLimit({
      key: requestRateLimitKey(request, "tmdb-discover", user.id),
      limit: 60,
      windowMs: 60 * 1000,
    });

    if (retryAfter) {
      return rateLimitResponse(retryAfter);
    }

    const rail = parseDiscoverRail(request.nextUrl.searchParams.get("rail"));
    const type = parseDiscoverType(request.nextUrl.searchParams.get("type"));
    const page = normalizePage(request.nextUrl.searchParams.get("page"));

    if (rail) {
      const railPage = await loadRailPage(rail, type, page, user.id);

      return NextResponse.json({ rail, type, page, ...railPage });
    }

    const rails = await Promise.all(
      DISCOVER_RAILS.map(async (name) => {
        const railPage = await loadRailPage(name, "all", 1, user.id);

        return { rail: name, results: railPage.results.slice(0, DISCOVER_RAIL_SIZE) };
      }),
    );

    return NextResponse.json({ rails });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to load discover titles." }, { status: 500 });
  }
}

async function loadRailPage(rail: DiscoverRail, type: DiscoverType, page: number, userId: string) {
  const { items, totalPages } = await fetchRailItems(rail, type, page);
  const withPoster = items.filter((item) => Boolean(item.data.poster_path));
  const [localMovieState, localShowState] = await Promise.all([
    loadLocalMovieState(
      withPoster.filter((item) => item.kind === "movie").map((item) => item.data.id),
      userId,
    ),
    loadLocalShowState(
      withPoster.filter((item) => item.kind === "show").map((item) => item.data.id),
      userId,
    ),
  ]);
  const results: MediaSearchResult[] = withPoster.map((item) =>
    item.kind === "movie"
      ? toMovieSearchResult(item.data, localMovieState.get(item.data.id) ?? null)
      : toTvSearchResult(item.data, localShowState.get(item.data.id) ?? null),
  );

  return {
    totalPages,
    // Anticipated is for finding something new, so titles already in the library are hidden there.
    results: rail === "anticipated" ? results.filter((result) => !result.alreadyInLibrary) : results,
  };
}

async function fetchRailItems(
  rail: DiscoverRail,
  type: DiscoverType,
  page: number,
): Promise<RailPage> {
  const wantsMovies = type !== "show";
  const wantsShows = type !== "movie";

  if (rail === "trending") {
    const response = await getTmdbTrending(
      type === "all" ? "all" : type === "movie" ? "movie" : "tv",
      page,
    );
    const items: RailItem[] = [];

    response.results.forEach((result) => {
      const kind = result.media_type ?? (type === "show" ? "tv" : "movie");

      if (kind === "movie") {
        items.push({ kind: "movie", data: result as TmdbMovieSearchResult });
      } else if (kind === "tv") {
        items.push({ kind: "show", data: result as TmdbTvSearchResult });
      }
    });

    return { items, totalPages: response.total_pages };
  }

  const today = new Date().toISOString().slice(0, 10);
  const [movies, shows] = await Promise.all([
    wantsMovies
      ? rail === "popular"
        ? getTmdbPopularMovies(page)
        : getTmdbUpcomingMovies(page)
      : null,
    wantsShows
      ? rail === "popular"
        ? getTmdbPopularTv(page)
        : getTmdbUpcomingTv(today, page)
      : null,
  ]);

  return {
    items: interleave<RailItem>(
      (movies?.results ?? []).map((data) => ({ kind: "movie", data })),
      (shows?.results ?? []).map((data) => ({ kind: "show", data })),
    ),
    totalPages: Math.max(movies?.total_pages ?? 0, shows?.total_pages ?? 0),
  };
}

function normalizePage(value: string | null) {
  const page = Number(value);

  if (!Number.isInteger(page)) {
    return 1;
  }

  return Math.min(Math.max(page, 1), maximumTmdbPage);
}
