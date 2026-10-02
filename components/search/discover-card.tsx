import { Check, Film } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { searchResultHref } from "@/components/search/search-result-href";
import type { MediaSearchResult } from "@/lib/providers/tmdb/adapters";
import { tmdbImage } from "@/lib/providers/tmdb/images";

type DiscoverCardProps = {
  result: MediaSearchResult;
  // "rail" adds the title and type line under the poster; "grid" is posters only.
  variant: "rail" | "grid";
};

export function DiscoverCard({ result, variant }: DiscoverCardProps) {
  const year = result.releaseYear ?? result.firstAirYear;
  const typeLabel = result.mediaType === "show" ? "Show" : "Movie";
  const subtitle = year ? `${typeLabel} · ${year}` : typeLabel;
  const ariaLabel = [result.title, subtitle, result.alreadyInLibrary ? "In library" : null]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      aria-label={ariaLabel}
      className={`block min-w-0 active:opacity-70 ${variant === "rail" ? "w-28 shrink-0" : ""}`}
      href={searchResultHref(result)}
    >
      <div
        aria-hidden="true"
        className="relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-muted"
      >
        {result.posterPath ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            {...tmdbImage(result.posterPath, variant === "rail" ? "railPoster" : "searchPoster")}
          />
        ) : (
          <Film className="h-5 w-5 text-text-faint" strokeWidth={1.8} />
        )}
        {result.alreadyInLibrary ? (
          <span className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-watched text-black">
            <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      {variant === "rail" ? (
        <>
          <p className="mt-1.5 truncate text-[12px] font-semibold leading-[1.25] text-foreground">
            {result.title}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-text-faint">{subtitle}</p>
        </>
      ) : null}
    </Link>
  );
}
