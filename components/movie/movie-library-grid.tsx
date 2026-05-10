"use client";

import { useState, useCallback } from "react";
import { PosterCard } from "@/components/movie/poster-card";
import { BulkActionsBar } from "@/components/movie/bulk-actions-bar";
import type { Tag, UserMovieWithMovie } from "@/lib/db/types";

type Props = {
  movies: UserMovieWithMovie[];
  allTags?: Tag[];
  pageStatus?: "watched" | "to_watch";
  showGenreFilter?: boolean;
};

export function MovieLibraryGrid({
  movies,
  allTags = [],
  pageStatus = "watched",
  showGenreFilter = true,
}: Props) {
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const genres = Array.from(
    new Set(
      movies.flatMap(({ movie }) =>
        movie.primary_genre_name ? [movie.primary_genre_name] : [],
      ),
    ),
  ).slice(0, 6);

  const filtered =
    activeGenre === null
      ? movies
      : movies.filter(({ movie }) => movie.primary_genre_name === activeGenre);

  const handleToggle = useCallback((movieId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) {
        next.delete(movieId);
      } else {
        next.add(movieId);
      }
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

  const selectedIdsArray = Array.from(selectedIds);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {showGenreFilter && genres.length > 0 ? (
          <section className="flex flex-1 gap-2 overflow-x-auto pb-1">
            {(["All", ...genres] as const).map((label) => {
              const isActive =
                label === "All" ? activeGenre === null : activeGenre === label;
              return (
                <button
                  key={label}
                  onClick={() =>
                    setActiveGenre(label === "All" ? null : (label as string))
                  }
                  className={[
                    "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px]",
                    isActive
                      ? "bg-accent/15 font-semibold text-accent"
                      : "border border-border bg-surface text-text-2",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </section>
        ) : (
          <div className="flex-1" />
        )}

        <button
          type="button"
          onClick={isSelecting ? exitSelectMode : enterSelectMode}
          className={[
            "shrink-0 text-[13px] font-medium",
            isSelecting ? "text-accent" : "text-text-2",
          ].join(" ")}
          style={{ minHeight: 36, paddingLeft: 8, paddingRight: 8 }}
        >
          {isSelecting ? "Done" : "Select"}
        </button>
      </div>

      {filtered.length > 0 ? (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          {filtered.map(({ movie }) => (
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
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No movies in this genre yet.
        </section>
      )}

      {isSelecting && selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={selectedIdsArray}
          allTags={allTags}
          pageStatus={pageStatus}
          onDone={exitSelectMode}
        />
      )}
    </div>
  );
}
