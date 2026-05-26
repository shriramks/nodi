import Link from "next/link";
import type { Metadata } from "next";
import { MovieLibraryGrid } from "@/components/movie/movie-library-grid";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { PageHeader } from "@/components/ui/section";
import { getMediaWatchedMovieLibrarySummary, listMediaLibraryMoviesPage, listTags } from "@/lib/db/queries";
import type { LibraryStatsBreakdownItem } from "@/lib/db/types";

export const metadata: Metadata = {
  title: "Movies",
};

const ratingOps = [">=", ">", "=", "<", "<="] as const;

type MoviesSearchParams = Record<string, string | string[] | undefined>;

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<MoviesSearchParams>;
}) {
  const params = await searchParams;
  const filters = parseMovieFilters(params);
  const [watchedPage, summary, allTags] = await Promise.all([
    listMediaLibraryMoviesPage({
      status: "watched",
      filters: {
        genre: filters.genre,
        language: filters.language,
        tagNames: filters.tags,
        rating: filters.ratingVal === null ? undefined : {
          op: filters.ratingOp,
          value: filters.ratingVal,
        },
        watchedYear: filters.year,
        watchedMonth: filters.month,
      },
    }),
    getMediaWatchedMovieLibrarySummary(),
    listTags(),
  ]);
  const activeLabels = filterLabels(filters, allTags);
  const returnToStatsHref = safeStatsHref(firstParam(params.returnTo));
  const showStatsReturn = firstParam(params.from) === "stats";

  return (
    <main className="space-y-4">
      <PageHeader
        title="Movies"
        action={<SettingsSheet />}
        leading={showStatsReturn ? (
          <Link
            href={returnToStatsHref}
            className="-ml-1 inline-flex min-h-11 items-center text-[17px] text-accent"
          >
            ‹ Stats
          </Link>
        ) : null}
        subtitle={(
          <>
            <span className="tabnum">
              {activeLabels.length > 0 ? watchedPage.totalCount : summary.watchedCount}
            </span>{" "}
            watched
            {activeLabels.length > 0 && <> · {activeLabels.join(" · ")}</>}
          </>
        )}
      />

      {watchedPage.movies.length > 0 || activeLabels.length > 0 ? (
        <MovieLibraryGrid
          key={libraryGridKey(filters)}
          initialPage={watchedPage}
          allTags={allTags}
          pageStatus="watched"
          activeFilters={filters}
          filterOptions={{
            genres: breakdownOptions(summary.genreBreakdown),
            languages: breakdownOptions(summary.languageBreakdown.filter((item) => item.key !== "unknown")),
            years: [...summary.yearBuckets].filter((bucket) => bucket.count > 0).reverse(),
            months: summary.monthBuckets,
          }}
        />
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          {activeLabels.length > 0
            ? "No movies match the current filter."
            : "No watched movies yet. Search for a film to get started."}
        </section>
      )}
    </main>
  );
}

function parseMovieFilters(params: MoviesSearchParams) {
  const ratingOp = parseRatingOp(firstParam(params.ratingOp)) ?? ">=";
  const ratingVal = parseRating(firstParam(params.rating));
  const month = parseMonth(firstParam(params.month));
  const year = month ? undefined : parseYear(firstParam(params.year));

  return {
    genre: cleanParam(firstParam(params.genre)),
    language: cleanParam(firstParam(params.language))?.toLowerCase(),
    tags: allParams(params.tag).map((tag) => tag.trim()).filter(Boolean),
    ratingOp,
    ratingVal,
    year,
    month,
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function allParams(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

function cleanParam(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

function parseRatingOp(value: string | undefined) {
  return ratingOps.find((op) => op === value);
}

function parseRating(value: string | undefined) {
  if (!value) {
    return null;
  }

  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return null;
  }
  return rating;
}

function parseYear(value: string | undefined) {
  return value && /^\d{4}$/.test(value) ? value : undefined;
}

function parseMonth(value: string | undefined) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined;
}

function safeStatsHref(value: string | undefined) {
  return value?.startsWith("/stats") ? value : "/stats";
}

function breakdownOptions(items: LibraryStatsBreakdownItem[]) {
  return items
    .filter((item) => item.key !== "unknown")
    .map((item) => ({ key: item.key, label: item.label, count: item.count }));
}

function filterLabels(filters: ReturnType<typeof parseMovieFilters>, tags: { name: string }[]) {
  const labels: string[] = [];

  if (filters.genre) labels.push(filters.genre);
  if (filters.language) labels.push(languageLabel(filters.language));
  if (filters.month) labels.push(monthLabel(filters.month));
  else if (filters.year) labels.push(filters.year);
  for (const tag of filters.tags) {
    labels.push(tags.find((t) => t.name.toLowerCase() === tag.toLowerCase())?.name ?? tag);
  }
  if (filters.ratingVal !== null) labels.push(`Rating ${filters.ratingOp} ${filters.ratingVal}`);

  return labels;
}

function libraryGridKey(filters: ReturnType<typeof parseMovieFilters>) {
  return JSON.stringify(filters);
}

function languageLabel(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function monthLabel(value: string) {
  const date = new Date(`${value}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
