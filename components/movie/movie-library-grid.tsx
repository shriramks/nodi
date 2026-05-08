"use client";

import { useState } from "react";
import { PosterCard } from "@/components/movie/poster-card";
import type { UserMovieWithMovie } from "@/lib/db/types";

type Props = {
  movies: UserMovieWithMovie[];
};

export function MovieLibraryGrid({ movies }: Props) {
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {genres.length > 0 && (
        <section className="flex gap-2 overflow-x-auto pb-1">
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
      )}

      {filtered.length > 0 ? (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
          {filtered.map(({ movie }) => (
            <PosterCard
              key={movie.id}
              movieId={movie.id}
              title={movie.title}
              posterPath={movie.poster_path}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No movies in this genre yet.
        </section>
      )}
    </div>
  );
}
