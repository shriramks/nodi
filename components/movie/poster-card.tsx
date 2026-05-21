import { Film, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { tmdbImage } from "@/lib/providers/tmdb/images";

type PosterCardProps = {
  movieId: string;
  title: string;
  posterPath: string | null;
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggle?: (movieId: string) => void;
};

export function PosterCard({
  movieId,
  title,
  posterPath,
  isSelectable = false,
  isSelected = false,
  onToggle,
}: PosterCardProps) {
  const poster = (
    <div className="relative">
      <div
        className={[
          "relative flex aspect-[2/3] items-center justify-center overflow-hidden rounded-2xl border bg-surface-muted transition-transform duration-200",
          isSelectable
            ? isSelected
              ? "border-accent ring-2 ring-accent"
              : "border-border"
            : "border-border group-hover:-translate-y-0.5",
        ].join(" ")}
      >
        {posterPath ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            {...tmdbImage(posterPath, "gridPoster")}
          />
        ) : (
          <Film aria-hidden="true" className="h-7 w-7 text-text-faint" strokeWidth={1.8} />
        )}

        {isSelectable && (
          <div
            className={[
              "absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2",
              isSelected
                ? "border-accent bg-accent"
                : "border-white/80 bg-black/30",
            ].join(" ")}
            aria-hidden="true"
          >
            {isSelected && (
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
            )}
          </div>
        )}

        {isSelectable && isSelected && (
          <div className="absolute inset-0 rounded-2xl bg-accent/10" />
        )}
      </div>
    </div>
  );

  if (isSelectable) {
    return (
      <button
        type="button"
        onClick={() => onToggle?.(movieId)}
        className="block w-full text-left"
        aria-label={`${isSelected ? "Deselect" : "Select"} ${title}`}
        aria-pressed={isSelected}
      >
        {poster}
      </button>
    );
  }

  return (
    <Link href={`/movie/${movieId}`} className="group block" aria-label={title}>
      {poster}
    </Link>
  );
}
