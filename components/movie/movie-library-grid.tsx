"use client";

import { useState, useCallback, useMemo } from "react";
import { PosterCard } from "@/components/movie/poster-card";
import { BulkActionsBar } from "@/components/movie/bulk-actions-bar";
import type { Tag, UserMovieWithMovie } from "@/lib/db/types";

// ─── Sort / filter types ──────────────────────────────────────────────────────

type SortKey = "watched_date" | "added_date" | "rating" | "title";
type SortDir = "asc" | "desc";
type RatingOp = ">=" | ">" | "=" | "<" | "<=";

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
  movies: UserMovieWithMovie[];
  allTags?: Tag[];
  pageStatus?: "watched" | "to_watch";
};

export function MovieLibraryGrid({
  movies,
  allTags = [],
  pageStatus = "watched",
}: Props) {
  const isWatched = pageStatus === "watched";
  const sortOptions = isWatched ? WATCHED_SORT_OPTIONS : TO_WATCH_SORT_OPTIONS;

  const [sortKey, setSortKey] = useState<SortKey>(sortOptions[0].key);
  const [sortDir, setSortDir] = useState<SortDir>(sortOptions[0].defaultDir);

  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [filterRatingOp, setFilterRatingOp] = useState<RatingOp>(">=");
  const [filterRatingVal, setFilterRatingVal] = useState<number | null>(null);

  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleSortSelect(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      const opt = sortOptions.find((o) => o.key === key)!;
      setSortKey(key);
      setSortDir(opt.defaultDir);
    }
  }

  function toggleFilterTag(tagId: string) {
    setFilterTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function clearFilters() {
    setFilterTags(new Set());
    setFilterRatingVal(null);
    setFilterRatingOp(">=");
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

  const hasActiveFilter = filterTags.size > 0 || filterRatingVal !== null;
  const sortPillActive = sortKey !== sortOptions[0].key;
  const sortPillLabel = sortPillActive
    ? sortOptions.find((o) => o.key === sortKey)!.label
    : "Sort";
  const currentSortOption = sortOptions.find((o) => o.key === sortKey)!;

  // ─── Processed movies ─────────────────────────────────────────────────────

  const processed = useMemo(() => {
    let result = movies.filter((um) => {
      if (filterTags.size > 0) {
        const movieTagIds = new Set(um.tags.map((t) => t.id));
        if (![...filterTags].some((id) => movieTagIds.has(id))) return false;
      }
      if (filterRatingVal !== null) {
        const r = um.personal_rating;
        if (r === null) return false;
        if (filterRatingOp === ">=" && r < filterRatingVal) return false;
        if (filterRatingOp === ">" && r <= filterRatingVal) return false;
        if (filterRatingOp === "=" && r !== filterRatingVal) return false;
        if (filterRatingOp === "<" && r >= filterRatingVal) return false;
        if (filterRatingOp === "<=" && r > filterRatingVal) return false;
      }
      return true;
    });

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
  }, [movies, sortKey, sortDir, filterTags, filterRatingVal, filterRatingOp]);

  // ─── Grouping ─────────────────────────────────────────────────────────────

  type Group = { label: string; items: UserMovieWithMovie[] };

  const groups = useMemo((): Group[] | null => {
    if (sortKey === "title") return null;

    const map = new Map<string, UserMovieWithMovie[]>();
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
                onClick={() => setSortSheetOpen(true)}
                className={[
                  "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[13px]",
                  sortPillActive
                    ? "border-accent/30 bg-accent/10 font-semibold text-accent"
                    : "border-border bg-surface text-text-2",
                ].join(" ")}
              >
                {sortPillLabel}
                <span className="text-[9px] opacity-40">▾</span>
              </button>

              {isWatched && (
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(true)}
                  className={[
                    "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[13px]",
                    hasActiveFilter
                      ? "border-accent/30 bg-accent/10 font-semibold text-accent"
                      : "border-border bg-surface text-text-2",
                  ].join(" ")}
                >
                  Filter
                  {hasActiveFilter && (
                    <span className="size-1.5 rounded-full bg-accent" />
                  )}
                  <span className="text-[9px] opacity-40">▾</span>
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
            style={{ minHeight: 36, paddingLeft: 8, paddingRight: 8 }}
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
                <div className="flex items-center gap-3 px-1 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                    {label}
                  </span>
                  <div className="h-px flex-1 bg-divider" />
                </div>
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
      </div>

      {isSelecting && selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={[...selectedIds]}
          allTags={allTags}
          pageStatus={pageStatus}
          onDone={exitSelectMode}
        />
      )}

      {/* Sort sheet */}
      {sortSheetOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setSortSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-surface pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center py-2.5">
              <div className="h-1 w-9 rounded-full bg-surface-muted" />
            </div>
            <p className="px-5 pb-3 text-[17px] font-semibold">Sort</p>

            {sortOptions.map((opt, i) => {
              const isSelected = sortKey === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
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

                  {isSelected && (
                    <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      {opt.dirLabel(sortDir)}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="h-2" />
          </div>
        </div>
      )}

      {/* Filter sheet — watched page only */}
      {isWatched && filterSheetOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setFilterSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-surface pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center py-2.5">
              <div className="h-1 w-9 rounded-full bg-surface-muted" />
            </div>
            <p className="px-5 pb-3 text-[17px] font-semibold">Filter</p>

            {allTags.length > 0 && (
              <>
                <p className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                  Tags
                </p>
                <div className="flex flex-wrap gap-2 px-5 pb-4">
                  {allTags.map((tag) => {
                    const active = filterTags.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleFilterTag(tag.id)}
                        className={[
                          "h-8 rounded-full border px-3 text-[13px]",
                          active
                            ? "border-accent/30 bg-accent/15 font-semibold text-accent"
                            : "border-border text-text-2",
                        ].join(" ")}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
                <div className="mx-5 h-px bg-divider" />
              </>
            )}

            <p className="px-5 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
              Rating
            </p>

            <div className="flex gap-1.5 px-5 pb-3">
              {RATING_OPS.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setFilterRatingOp(op)}
                  className={[
                    "flex h-8 w-9 items-center justify-center rounded-xl border text-[14px]",
                    filterRatingOp === op
                      ? "border-accent/30 bg-accent/15 font-semibold text-accent"
                      : "border-border text-text-2",
                  ].join(" ")}
                >
                  {OP_SYMBOL[op]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 px-5 pb-1">
              <div className="flex items-center gap-4 rounded-xl bg-surface-muted px-4 py-2">
                <button
                  type="button"
                  className="text-[20px] font-light text-text-2 active:text-foreground"
                  onClick={() =>
                    setFilterRatingVal((v) => (v === null || v <= 1 ? null : v - 1))
                  }
                >
                  −
                </button>
                <span className="tabnum min-w-[20px] text-center text-[20px] font-semibold text-accent">
                  {filterRatingVal ?? "—"}
                </span>
                <button
                  type="button"
                  className="text-[20px] font-light text-text-2 active:text-foreground"
                  onClick={() =>
                    setFilterRatingVal((v) => (v === null ? 7 : Math.min(v + 1, 10)))
                  }
                >
                  +
                </button>
              </div>
              {filterRatingVal !== null ? (
                <span className="text-[12px] text-text-faint">
                  rated {OP_SYMBOL[filterRatingOp]} {filterRatingVal}
                </span>
              ) : (
                <span className="text-[12px] text-text-faint">tap + to set a rating filter</span>
              )}
            </div>

            <div
              className="mx-5 mt-4 flex gap-3 pt-4"
              style={{ borderTop: "1px solid var(--divider)" }}
            >
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setFilterSheetOpen(false);
                }}
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border text-[15px] font-medium text-text-2"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="flex h-11 flex-[1.6] items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-black"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
