import Image from "next/image";
import Link from "next/link";
import { Film, Tv } from "lucide-react";

import { tmdbImageUrl } from "@/lib/providers/tmdb/images";

type CreditPosterCardProps = {
  href?: string | null;
  mediaType?: "movie" | "tv";
  posterPath: string | null;
  subtitle?: string | null;
  title: string;
};

export function CreditPosterCard({
  href,
  mediaType = "movie",
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
            height={513}
            sizes="112px"
            src={tmdbImageUrl(posterPath, "w342")}
            width={342}
          />
        ) : mediaType === "tv" ? (
          <Tv aria-hidden="true" className="h-6 w-6 text-text-faint" strokeWidth={1.7} />
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
