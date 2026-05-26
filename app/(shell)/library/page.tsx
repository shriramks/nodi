import Link from "next/link";
import type { Metadata } from "next";

import { LibraryGrid } from "@/components/library/library-grid";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { PageHeader } from "@/components/ui/section";
import {
  getMediaWatchedMovieLibrarySummary,
  listMediaLibraryMoviesPage,
  listTags,
} from "@/lib/db/queries";
import type { LibraryStatsBreakdownItem, MediaTypeFilter } from "@/lib/db/types";
import {
  firstParam,
  parseLibraryType,
  parseMovieFilters,
  safeStatsHref,
  type LibrarySearchParams,
} from "./library-route";

export const metadata: Metadata = {
  title: "Library",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const params = await searchParams;
  const type = parseLibraryType(firstParam(params.type));
  const filters = parseMovieFilters(params);
  const [watchedPage, summary, allTags] = await Promise.all([
    listMediaLibraryMoviesPage({
      status: "watched",
      type,
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
    getMediaWatchedMovieLibrarySummary(type),
    listTags(),
  ]);
  const activeLabels = filterLabels(filters, allTags, type);
  const returnToStatsHref = safeStatsHref(firstParam(params.returnTo));
  const showStatsReturn = firstParam(params.from) === "stats";

  return (
    <main className="space-y-4">
      <PageHeader
        title="Library"
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
        <LibraryGrid
          key={libraryGridKey(filters, type)}
          initialPage={watchedPage}
          allTags={allTags}
          pageStatus="watched"
          libraryType={type}
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
            ? "No library items match the current filter."
            : "No watched library items yet. Search for a title to get started."}
        </section>
      )}
    </main>
  );
}

function breakdownOptions(items: LibraryStatsBreakdownItem[]) {
  return items
    .filter((item) => item.key !== "unknown")
    .map((item) => ({ key: item.key, label: item.label, count: item.count }));
}

function filterLabels(
  filters: ReturnType<typeof parseMovieFilters>,
  tags: { name: string }[],
  type: MediaTypeFilter,
) {
  const labels: string[] = [];

  if (type !== "all") labels.push(type === "movie" ? "Movies" : "Shows");
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

function libraryGridKey(filters: ReturnType<typeof parseMovieFilters>, type: MediaTypeFilter) {
  return JSON.stringify({ filters, type });
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
