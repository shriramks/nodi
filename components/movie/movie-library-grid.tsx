"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronDown, ListFilter, LoaderCircle, X } from "lucide-react";
import { PosterCard } from "@/components/movie/poster-card";
import { BulkActionsBar } from "@/components/movie/bulk-actions-bar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  SectionHeader,
  SheetSection,
  SheetSectionDivider,
  SheetSectionHeader,
  SheetScrollBleed,
} from "@/components/ui/section";
import type {
  LibraryMovie,
  LibraryStatsTimeBucket,
  Tag,
} from "@/lib/db/types";
import type { LibraryMoviePage } from "@/lib/db/queries";

// ─── Sort / filter types ──────────────────────────────────────────────────────

type SortKey = "watched_date" | "added_date" | "rating" | "title";
type SortDir = "asc" | "desc";
type RatingOp = ">=" | ">" | "=" | "<" | "<=";
type TimeMode = "year" | "month";

interface SortOption {
  key: SortKey;
  label: string;
  defaultDir: SortDir;
  dirLabel: (dir: SortDir) => string;
}

const WATCHED_SORT_OPTIONS: SortOption[] = [
  {
    key: "watched_date",
    label: "Recently watched",
    defaultDir: "desc",
    dirLabel: (d) => (d === "desc" ? "Latest first" : "Oldest first"),
  },
  {
    key: "rating",
    label: "Rating",
    defaultDir: "desc",
    dirLabel: (d) => (d === "desc" ? "High to low" : "Low to high"),
  },
  {
    key: "title",
    label: "Title",
    defaultDir: "asc",
    dirLabel: (d) => (d === "asc" ? "A → Z" : "Z → A"),
  },
];

const TO_WATCH_SORT_OPTIONS: SortOption[] = [
  {
    key: "added_date",
    label: "Recently added",
    defaultDir: "desc",
    dirLabel: (d) => (d === "desc" ? "Latest first" : "Oldest first"),
  },
  {
    key: "title",
    label: "Title",
    defaultDir: "asc",
    dirLabel: (d) => (d === "asc" ? "A → Z" : "Z → A"),
  },
];

const RATING_OPS: RatingOp[] = [">=", ">", "=", "<", "<="];
const OP_SYMBOL: Record<RatingOp, string> = {
  ">=": "≥",
  ">": ">",
  "=": "=",
  "<": "<",
  "<=": "≤",
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  initialPage: LibraryMoviePage;
  allTags?: Tag[];
  pageStatus?: "watched" | "to_watch";
  activeFilters?: MovieLibraryActiveFilters;
  filterOptions?: MovieLibraryFilterOptions;
};

export type MovieLibraryActiveFilters = {
  genre?: string;
  language?: string;
  tags: string[];
  ratingOp: RatingOp;
  ratingVal: number | null;
  year?: string;
  month?: string;
};

export type MovieLibraryFilterOptions = {
  genres: Array<{ key: string; label: string; count: number }>;
  languages: Array<{ key: string; label: string; count: number }>;
  years: LibraryStatsTimeBucket[];
  months: LibraryStatsTimeBucket[];
};

export function MovieLibraryGrid({
  initialPage,
  allTags,
  pageStatus = "watched",
  activeFilters = emptyActiveFilters,
  filterOptions = emptyFilterOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isWatched = pageStatus === "watched";
  const availableTags = allTags ?? [];
  const sortOptions = isWatched ? WATCHED_SORT_OPTIONS : TO_WATCH_SORT_OPTIONS;

  const sortStorageKey = `nodi:lib:sort:${pageStatus}`;

  const [sortState, setSortState] = useState(() => initialSortState(sortOptions));
  const sortKey = sortState.key;
  const sortDir = sortState.dir;
  const [sortHydrated, setSortHydrated] = useState(false);

  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [draftSortState, setDraftSortState] = useState(() => initialSortState(sortOptions));
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftGenre, setDraftGenre] = useState<string | undefined>(activeFilters.genre);
  const [draftLanguage, setDraftLanguage] = useState<string | undefined>(activeFilters.language);
  const [draftTags, setDraftTags] = useState<Set<string>>(new Set(activeFilters.tags));
  const [draftRatingOp, setDraftRatingOp] = useState<RatingOp>(activeFilters.ratingOp);
  const [draftRatingVal, setDraftRatingVal] = useState<number | null>(activeFilters.ratingVal);
  const [draftTimeMode, setDraftTimeMode] = useState<TimeMode>(activeFilters.month ? "month" : "year");
  const [draftYear, setDraftYear] = useState<string | undefined>(activeFilters.year ?? yearFromMonth(activeFilters.month));
  const [draftMonth, setDraftMonth] = useState<string | undefined>(activeFilters.month);
  const [movies, setMovies] = useState(initialPage.movies);
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedSortRef = useRef(initialSortState(sortOptions));
  const loadingRequestRef = useRef<AbortController | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedSort = storedSortState(sortStorageKey, sortOptions);
      if (storedSort) {
        setSortState(storedSort);
      }
      setSortHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [sortOptions, sortStorageKey]);

  // Persist sort state
  useEffect(() => {
    if (!sortHydrated) {
      return;
    }
    localStorage.setItem(sortStorageKey, JSON.stringify({ key: sortKey, dir: sortDir }));
  }, [sortHydrated, sortKey, sortDir, sortStorageKey]);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function openSortSheet() {
    setDraftSortState(sortState);
    setSortSheetOpen(true);
  }

  function handleSortSelect(key: SortKey) {
    if (key === draftSortState.key) {
      return;
    }

    const opt = sortOptions.find((o) => o.key === key)!;
    setDraftSortState({ key, dir: opt.defaultDir });
  }

  function applySort() {
    setSortState(draftSortState);
    setSortSheetOpen(false);
  }

  const loadPage = useCallback(async (offset: number, mode: "append" | "replace") => {
    loadingRequestRef.current?.abort();
    const abortController = new AbortController();
    loadingRequestRef.current = abortController;
    setIsLoadingPage(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({
        status: pageStatus,
        offset: String(offset),
        sortKey,
        sortDir,
      });
      appendFilterParams(params, activeFilters);

      const response = await fetch(`/api/library/movies?${params.toString()}`, {
        headers: {
          accept: "application/json",
        },
        signal: abortController.signal,
      });
      const payload = (await response.json()) as LibraryMoviePage | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error ?? "Failed to load movies." : "Failed to load movies.");
      }

      const page = payload as LibraryMoviePage;
      loadedSortRef.current = sortState;
      setMovies((current) => mode === "append" ? [...current, ...page.movies] : page.movies);
      setTotalCount(page.totalCount);
      setNextOffset(page.nextOffset);
      setHasMore(page.hasMore);
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      setLoadError(error instanceof Error ? error.message : "Failed to load movies.");
    } finally {
      if (loadingRequestRef.current === abortController) {
        loadingRequestRef.current = null;
        setIsLoadingPage(false);
      }
    }
  }, [activeFilters, pageStatus, sortDir, sortKey, sortState]);

  const loadNextPage = useCallback(async () => {
    if (!hasMore || nextOffset === null || isLoadingPage) {
      return;
    }

    await loadPage(nextOffset, "append");
  }, [hasMore, isLoadingPage, loadPage, nextOffset]);

  useEffect(() => {
    if (!sortHydrated || sameSort(loadedSortRef.current, sortState)) {
      return;
    }

    void loadPage(0, "replace");
  }, [loadPage, sortHydrated, sortState]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;

    if (!sentinel || !hasMore || isLoadingPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPage();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, isLoadingPage, loadNextPage]);

  function toggleDraftTag(tagName: string) {
    setDraftTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return next;
    });
  }

  function clearFilters() {
    router.push(pathname);
  }

  function clearDraftFilters() {
    setDraftGenre(undefined);
    setDraftLanguage(undefined);
    setDraftTags(new Set());
    setDraftRatingOp(">=");
    setDraftRatingVal(null);
    setDraftTimeMode("year");
    setDraftYear(undefined);
    setDraftMonth(undefined);
  }

  function openFilterSheet() {
    setDraftGenre(activeFilters.genre);
    setDraftLanguage(activeFilters.language);
    setDraftTags(new Set(activeFilters.tags));
    setDraftRatingOp(activeFilters.ratingOp);
    setDraftRatingVal(activeFilters.ratingVal);
    setDraftTimeMode(activeFilters.month ? "month" : "year");
    setDraftYear(activeFilters.year ?? yearFromMonth(activeFilters.month));
    setDraftMonth(activeFilters.month);
    setFilterSheetOpen(true);
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    clearFilterParams(params);

    if (draftFilters.genre) params.set("genre", draftFilters.genre);
    if (draftFilters.language) params.set("language", draftFilters.language);
    for (const tag of draftFilters.tags) {
      params.append("tag", tag);
    }
    if (draftFilters.ratingVal !== null) {
      params.set("ratingOp", draftFilters.ratingOp);
      params.set("rating", String(draftFilters.ratingVal));
    }
    if (draftFilters.month) {
      params.set("month", draftFilters.month);
    } else if (draftFilters.year) {
      params.set("year", draftFilters.year);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setFilterSheetOpen(false);
  }

  const handleToggle = useCallback((movieId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  }, []);

  function enterSelectMode() {
    setIsSelecting(true);
    setSelectedIds(new Set());
  }

  function exitSelectMode() {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }

  // ─── Derived state ────────────────────────────────────────────────────────

  const activeFilterCount = countActiveFilters(activeFilters);
  const hasActiveFilter = activeFilterCount > 0;
  const defaultSortState = initialSortState(sortOptions);
  const sortPillActive = sortKey !== defaultSortState.key || sortDir !== defaultSortState.dir;
  const sortPillLabel = sortPillActive
    ? sortOptions.find((o) => o.key === sortKey)!.label
    : "Sort";
  const filterPillLabel = hasActiveFilter ? summarizeFilters(activeFilters) : "Filter";
  const draftFilters: MovieLibraryActiveFilters = {
    genre: draftGenre,
    language: draftLanguage,
    tags: [...draftTags],
    ratingOp: draftRatingOp,
    ratingVal: draftRatingVal,
    year: draftTimeMode === "year" ? draftYear : undefined,
    month: draftTimeMode === "month" ? draftMonth : undefined,
  };
  const hasDraftFilter = countActiveFilters(draftFilters) > 0;
  const selectedDraftSortOption = sortOptions.find((option) => option.key === draftSortState.key)!;
  const selectedYearForMonths = draftYear ?? yearFromMonth(draftMonth) ?? filterOptions.years[0]?.key;
  const visibleMonths = selectedYearForMonths
    ? filterOptions.months.filter((bucket) => bucket.key.startsWith(`${selectedYearForMonths}-`))
    : [];

  // ─── Processed movies ─────────────────────────────────────────────────────

  const processed = useMemo(() => {
    let result = movies;

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "watched_date": {
          const da = a.last_watched_at ? new Date(a.last_watched_at).getTime() : 0;
          const db = b.last_watched_at ? new Date(b.last_watched_at).getTime() : 0;
          cmp = da - db;
          break;
        }
        case "added_date": {
          const da = new Date(a.watchlisted_at ?? a.added_at).getTime();
          const db = new Date(b.watchlisted_at ?? b.added_at).getTime();
          cmp = da - db;
          break;
        }
        case "rating": {
          const ra = a.personal_rating ?? -1;
          const rb = b.personal_rating ?? -1;
          cmp = ra - rb;
          break;
        }
        case "title": {
          cmp = a.movie.title.localeCompare(b.movie.title);
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [movies, sortKey, sortDir]);

  // ─── Grouping ─────────────────────────────────────────────────────────────

  type Group = { label: string; items: LibraryMovie[] };

  const groups = useMemo((): Group[] | null => {
    if (sortKey === "title") return null;

    const map = new Map<string, LibraryMovie[]>();
    for (const um of processed) {
      let label: string;
      if (sortKey === "rating") {
        label = um.personal_rating !== null ? String(um.personal_rating) : "Unrated";
      } else {
        const dateStr =
          sortKey === "added_date"
            ? (um.watchlisted_at ?? um.added_at)
            : um.last_watched_at;
        label = dateStr
          ? new Date(dateStr).toLocaleString("en-US", { month: "long", year: "numeric" })
          : "Unknown";
      }
      const group = map.get(label) ?? [];
      group.push(um);
      map.set(label, group);
    }

    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [processed, sortKey]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const gridClass = "grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2";

  return (
    <>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          {isSelecting ? (
            <span className="text-[13px] text-text-2">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Tap to select"}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openSortSheet}
                className={[
                  "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px]",
                  sortPillActive
                    ? "border-accent/30 bg-accent/10 font-semibold text-accent"
                    : "border-border bg-surface text-text-2",
                ].join(" ")}
              >
                <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                {sortPillLabel}
                <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-45" strokeWidth={2.4} />
              </button>

              {isWatched && (
                <button
                  type="button"
                  onClick={openFilterSheet}
                  className={[
                    "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px]",
                    hasActiveFilter
                      ? "border-accent/30 bg-accent/10 font-semibold text-accent"
                      : "border-border bg-surface text-text-2",
                  ].join(" ")}
                >
                  <ListFilter aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  {filterPillLabel}
                  {hasActiveFilter && (
                    <span className="size-1.5 rounded-full bg-accent" />
                  )}
                  <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-45" strokeWidth={2.4} />
                </button>
              )}

              {isWatched && hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex size-11 items-center justify-center rounded-full text-text-2 active:bg-tap-active active:text-foreground"
                  aria-label="Reset filters"
                >
                  <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={isSelecting ? exitSelectMode : enterSelectMode}
            className={[
              "shrink-0 font-medium",
              isSelecting ? "text-[15px] text-accent" : "text-[13px] text-text-2",
            ].join(" ")}
            style={{ minHeight: 44, paddingLeft: 8, paddingRight: 8 }}
          >
            {isSelecting ? "Done" : "Select"}
          </button>
        </div>

        {/* Grid */}
        {processed.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
            No movies match the current filter.
          </section>
        ) : groups ? (
          <div className="space-y-1">
            {groups.map(({ label, items }) => (
              <section key={label}>
                <SectionHeader className="gap-3 px-1 font-semibold text-text-faint">
                  <span>{label}</span>
                  <div className="h-px flex-1 bg-divider" />
                </SectionHeader>
                <div className={gridClass}>
                  {items.map(({ movie }) => (
                    <PosterCard
                      key={movie.id}
                      movieId={movie.id}
                      title={movie.title}
                      posterPath={movie.poster_path}
                      isSelectable={isSelecting}
                      isSelected={selectedIds.has(movie.id)}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section className={gridClass}>
            {processed.map(({ movie }) => (
              <PosterCard
                key={movie.id}
                movieId={movie.id}
                title={movie.title}
                posterPath={movie.poster_path}
                isSelectable={isSelecting}
                isSelected={selectedIds.has(movie.id)}
                onToggle={handleToggle}
              />
            ))}
          </section>
        )}

        {hasMore || isLoadingPage || loadError ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden="true" />
            {loadError ? (
              <p className="text-[13px] text-danger">{loadError}</p>
            ) : null}
            {hasMore ? (
              <button
                type="button"
                onClick={() => void loadNextPage()}
                disabled={isLoadingPage}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13px] font-medium text-text-2 disabled:cursor-wait disabled:opacity-70"
              >
                {isLoadingPage ? (
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                ) : null}
                {isLoadingPage ? "Loading" : `Load more (${movies.length}/${totalCount})`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isSelecting && selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={[...selectedIds]}
          initialTags={allTags}
          pageStatus={pageStatus}
          onDone={exitSelectMode}
        />
      )}

      {/* Sort sheet */}
      {sortSheetOpen && (
        <BottomSheet
          ariaLabel="Sort Movies"
          contentClassName="pt-3"
          onClose={() => setSortSheetOpen(false)}
        >
          <div className="flex items-center justify-between px-5 pb-3">
            <p className="text-[17px] font-semibold">Sort</p>
            <button
              type="button"
              onClick={applySort}
              className="min-h-11 text-[15px] font-semibold text-accent"
            >
              Done
            </button>
          </div>

          <div role="radiogroup" aria-label="Sort by">
            {sortOptions.map((opt, i) => {
              const isSelected = draftSortState.key === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSortSelect(opt.key)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-tap-active"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--divider)" }}
                >
                  <span
                    className={[
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      isSelected ? "border-accent bg-accent" : "border-border",
                    ].join(" ")}
                  >
                    {isSelected && <span className="size-2 rounded-full bg-black" />}
                  </span>

                  <span
                    className={[
                      "flex-1 text-[15px]",
                      isSelected ? "font-medium text-foreground" : "text-text-2",
                    ].join(" ")}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          <SheetSectionDivider className="mt-3" />

          <SheetSection className="pb-2 pt-4">
            <SheetSectionHeader>Direction</SheetSectionHeader>
            <div
              role="radiogroup"
              aria-label="Sort direction"
              className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1"
            >
              {(["asc", "desc"] as SortDir[]).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  role="radio"
                  aria-checked={draftSortState.dir === dir}
                  onClick={() => setDraftSortState((state) => ({ ...state, dir }))}
                  className={[
                    "min-h-10 rounded-lg px-2 text-[13px] font-semibold",
                    draftSortState.dir === dir ? "bg-accent/10 text-accent" : "text-text-2",
                  ].join(" ")}
                >
                  {selectedDraftSortOption.dirLabel(dir)}
                </button>
              ))}
            </div>
          </SheetSection>
          <div className="h-2" />
        </BottomSheet>
      )}

      {/* Filter sheet — watched page only */}
      {isWatched && filterSheetOpen && (
        <BottomSheet
          ariaLabel="Filter Movies"
          contentClassName="pt-3"
          dismissButtonLabel="Close filters"
          onClose={() => setFilterSheetOpen(false)}
        >
          <div className="px-5 pb-3">
            <p className="text-[17px] font-semibold">Filter</p>
          </div>

          {filterOptions.genres.length > 0 && (
            <>
              <SheetSection className="pt-0">
                <SheetSectionHeader>Genre</SheetSectionHeader>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.genres.slice(0, 12).map((genre) => (
                    <FilterChip
                      key={genre.key}
                      active={draftGenre === genre.label}
                      label={genre.label}
                      count={genre.count}
                      onClick={() => setDraftGenre((current) => current === genre.label ? undefined : genre.label)}
                    />
                  ))}
                </div>
              </SheetSection>
              <SheetSectionDivider />
            </>
          )}

          {filterOptions.languages.length > 0 && (
            <>
              <SheetSection>
                <SheetSectionHeader>Language</SheetSectionHeader>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.languages.slice(0, 12).map((language) => (
                    <FilterChip
                      key={language.key}
                      active={draftLanguage === language.key}
                      label={language.label}
                      count={language.count}
                      onClick={() => setDraftLanguage((current) => current === language.key ? undefined : language.key)}
                    />
                  ))}
                </div>
              </SheetSection>
              <SheetSectionDivider />
            </>
          )}

          <SheetSection className="pb-3">
            <SheetSectionHeader>Watched date</SheetSectionHeader>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
              {(["year", "month"] as TimeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={draftTimeMode === mode}
                  onClick={() => setDraftTimeMode(mode)}
                  className={[
                    "min-h-10 rounded-lg text-[13px] font-semibold",
                    draftTimeMode === mode ? "bg-accent/10 text-accent" : "text-text-2",
                  ].join(" ")}
                >
                  {mode === "year" ? "Year" : "Month"}
                </button>
              ))}
            </div>
          </SheetSection>

          {filterOptions.years.length > 0 && (
            <div className="px-5 pb-4">
              {draftTimeMode === "year" ? (
                <div className="grid gap-2">
                  {filterOptions.years.map((year) => (
                    <button
                      key={year.key}
                      type="button"
                      aria-pressed={draftYear === year.key}
                      onClick={() => {
                        setDraftYear((current) => current === year.key ? undefined : year.key);
                        setDraftMonth(undefined);
                      }}
                      className={[
                        "flex min-h-11 items-center justify-between rounded-xl border px-3 text-left",
                        draftYear === year.key
                          ? "border-accent/30 bg-accent/15 text-accent"
                          : "border-border text-text-2",
                      ].join(" ")}
                    >
                      <span className="text-[15px] font-semibold">{year.label}</span>
                      <span className="tabnum text-[13px] opacity-70">{year.count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <SheetScrollBleed className="flex gap-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {filterOptions.years.map((year) => (
                      <button
                        key={year.key}
                        type="button"
                        aria-pressed={selectedYearForMonths === year.key}
                        onClick={() => {
                          setDraftYear(year.key);
                          setDraftMonth(undefined);
                        }}
                        className={[
                          "min-h-9 shrink-0 rounded-full border px-3 text-[13px]",
                          selectedYearForMonths === year.key
                            ? "border-accent/30 bg-accent/15 font-semibold text-accent"
                            : "border-border text-text-2",
                        ].join(" ")}
                      >
                        {year.label}
                      </button>
                    ))}
                  </SheetScrollBleed>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleMonths.map((month) => (
                      <button
                        key={month.key}
                        type="button"
                        aria-pressed={draftMonth === month.key}
                        onClick={() => {
                          setDraftMonth((current) => current === month.key ? undefined : month.key);
                          setDraftYear(yearFromMonth(month.key));
                        }}
                        className={[
                          "flex min-h-12 flex-col items-center justify-center rounded-xl border text-[13px]",
                          draftMonth === month.key
                            ? "border-accent/30 bg-accent/15 font-semibold text-accent"
                            : "border-border text-text-2",
                        ].join(" ")}
                      >
                        <span>{shortMonthLabel(month.key)}</span>
                        <span className="tabnum text-[11px] opacity-60">{month.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <SheetSectionDivider />

          {availableTags.length > 0 && (
            <>
              <SheetSection>
                <SheetSectionHeader>Tags</SheetSectionHeader>
                <SheetScrollBleed className="flex gap-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {availableTags.map((tag) => {
                    const active = draftTags.has(tag.name);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleDraftTag(tag.name)}
                        className={[
                          "min-h-9 shrink-0 rounded-full border px-3 text-[13px]",
                          active
                            ? "border-accent/30 bg-accent/15 font-semibold text-accent"
                            : "border-border text-text-2",
                        ].join(" ")}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </SheetScrollBleed>
              </SheetSection>
              <SheetSectionDivider />
            </>
          )}

          <SheetSection className="pb-1">
            <SheetSectionHeader>Rating</SheetSectionHeader>
            <div className="flex gap-1.5 pb-3">
              {RATING_OPS.map((op) => (
                <button
                  key={op}
                  type="button"
                  aria-pressed={draftRatingOp === op}
                  onClick={() => setDraftRatingOp(op)}
                  className={[
                    "flex min-h-9 w-9 items-center justify-center rounded-xl border text-[14px]",
                    draftRatingOp === op
                      ? "border-accent/30 bg-accent/15 font-semibold text-accent"
                      : "border-border text-text-2",
                  ].join(" ")}
                >
                  {OP_SYMBOL[op]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 rounded-xl bg-surface-muted px-4 py-2">
                <button
                  type="button"
                  className="text-[20px] font-light text-text-2 active:text-foreground"
                  onClick={() =>
                    setDraftRatingVal((v) => (v === null || v <= 1 ? null : v - 1))
                  }
                >
                  −
                </button>
                <span className="tabnum min-w-[20px] text-center text-[20px] font-semibold text-accent">
                  {draftRatingVal ?? "—"}
                </span>
                <button
                  type="button"
                  className="text-[20px] font-light text-text-2 active:text-foreground"
                  onClick={() =>
                    setDraftRatingVal((v) => (v === null ? 7 : Math.min(v + 1, 10)))
                  }
                >
                  +
                </button>
              </div>
              {draftRatingVal !== null ? (
                <span className="text-[12px] text-text-faint">
                  rated {OP_SYMBOL[draftRatingOp]} {draftRatingVal}
                </span>
              ) : (
                <span className="text-[12px] text-text-faint">tap + to set a rating filter</span>
              )}
            </div>
          </SheetSection>

          <div
            className="mx-5 mt-4 flex gap-3 pt-4"
            style={{ borderTop: "1px solid var(--divider)" }}
          >
            <button
              type="button"
              onClick={clearDraftFilters}
              disabled={!hasDraftFilter}
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border text-[15px] font-medium text-text-2 disabled:opacity-40"
            >
              Clear filters
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="flex h-11 flex-[1.6] items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-black"
            >
              Apply filters
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );

}

const emptyActiveFilters: MovieLibraryActiveFilters = {
  tags: [],
  ratingOp: ">=",
  ratingVal: null,
};

const emptyFilterOptions: MovieLibraryFilterOptions = {
  genres: [],
  languages: [],
  years: [],
  months: [],
};

function initialSortState(sortOptions: SortOption[]) {
  return {
    key: sortOptions[0].key,
    dir: sortOptions[0].defaultDir,
  };
}

function storedSortState(storageKey: string, sortOptions: SortOption[]) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const sortStr = window.localStorage.getItem(storageKey);
    if (!sortStr) {
      return null;
    }

    const parsed = JSON.parse(sortStr) as { key: SortKey; dir: SortDir };
    if (sortOptions.some((option) => option.key === parsed.key) && (parsed.dir === "asc" || parsed.dir === "desc")) {
      return parsed;
    }
  } catch {}

  return null;
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px]",
        active
          ? "border-accent/30 bg-accent/15 font-semibold text-accent"
          : "border-border text-text-2",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="tabnum text-[11px] opacity-60">{count}</span>
    </button>
  );
}

function clearFilterParams(params: URLSearchParams) {
  for (const key of ["genre", "language", "tag", "ratingOp", "rating", "year", "month"]) {
    params.delete(key);
  }
}

function countActiveFilters(filters: MovieLibraryActiveFilters) {
  let count = 0;
  if (filters.genre) count += 1;
  if (filters.language) count += 1;
  if (filters.tags.length > 0) count += filters.tags.length;
  if (filters.ratingVal !== null) count += 1;
  if (filters.month || filters.year) count += 1;
  return count;
}

function summarizeFilters(filters: MovieLibraryActiveFilters) {
  const count = countActiveFilters(filters);
  if (count > 1) return `${count} filters`;
  if (filters.genre) return filters.genre;
  if (filters.language) return languageLabel(filters.language);
  if (filters.month) return monthLabel(filters.month);
  if (filters.year) return `Year: ${filters.year}`;
  if (filters.tags[0]) return filters.tags[0];
  if (filters.ratingVal !== null) return `Rating ${OP_SYMBOL[filters.ratingOp]} ${filters.ratingVal}`;
  return "Filter";
}

function yearFromMonth(month: string | undefined) {
  return month?.slice(0, 4);
}

function shortMonthLabel(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
}

function monthLabel(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function languageLabel(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function sameSort(
  left: { key: SortKey; dir: SortDir },
  right: { key: SortKey; dir: SortDir },
) {
  return left.key === right.key && left.dir === right.dir;
}

function appendFilterParams(
  params: URLSearchParams,
  filters: MovieLibraryActiveFilters,
) {
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.language) params.set("language", filters.language);
  for (const tag of filters.tags) {
    params.append("tag", tag);
  }
  if (filters.ratingVal !== null) {
    params.set("ratingOp", filters.ratingOp);
    params.set("rating", String(filters.ratingVal));
  }
  if (filters.month) {
    params.set("month", filters.month);
  } else if (filters.year) {
    params.set("year", filters.year);
  }
}
