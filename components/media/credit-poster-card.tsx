import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";

import { tmdbImage } from "@/lib/providers/tmdb/images";

type CreditPosterCardProps = {
  href?: string | null;
  mediaType?: "movie" | "tv";
  posterPath: string | null;
  subtitle?: string | null;
  title: string;
};

export function CreditPosterCard({
  href,
  posterPath,
  subtitle,
  title,
}: CreditPosterCardProps) {
  const content = (
    <>
      <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
        {posterPath ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            {...tmdbImage(posterPath, "railPoster")}
          />
        ) : (
          <Film aria-hidden="true" className="h-6 w-6 text-text-faint" strokeWidth={1.7} />
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[12px] font-semibold leading-[1.25] text-foreground">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-0.5 truncate text-[11px] text-text-faint">
          {subtitle}
        </p>
      ) : null}
    </>
  );

  if (!href) {
    return <article className="w-28 shrink-0">{content}</article>;
  }

  return (
    <Link className="w-28 shrink-0 active:opacity-70" href={href}>
      {content}
    </Link>
  );
}
