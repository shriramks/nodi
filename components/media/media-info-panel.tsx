import type { ReactNode } from "react";
import Image from "next/image";
import { CheckCircle2, Film, Heart } from "lucide-react";
import { getTmdbRating, languageDisplayName } from "@/lib/media/format";
import { tmdbImage } from "@/lib/providers/tmdb/images";

type MediaInfoPanelProps = {
  className?: string;
  title: string;
  posterPath: string | null;
  releaseYear?: number | null;
  originalLanguage?: string | null;
  primaryGenreName?: string | null;
  tmdbVoteAverage?: number | null;
  tmdbVoteCount?: number | null;
  tags?: Array<{ id: string; name: string }>;
  personalRating?: number | null;
  ratingPicker?: ReactNode;
  statusLabel?: string | null;
  statusClassName?: string | null;
  showDoneIcon?: boolean;
  statusOverride?: ReactNode;
};

export function MediaInfoPanel({
  className,
  title,
  posterPath,
  releaseYear,
  originalLanguage,
  primaryGenreName,
  tmdbVoteAverage,
  tmdbVoteCount,
  tags,
  personalRating,
  ratingPicker,
  statusLabel,
  statusClassName,
  showDoneIcon = false,
  statusOverride,
}: MediaInfoPanelProps) {
  const metaLine = [
    releaseYear,
    originalLanguage ? languageDisplayName(originalLanguage) : null,
    primaryGenreName,
  ]
    .filter(Boolean)
    .join(" · ");

  const tmdbRating = getTmdbRating({
    tmdb_vote_average: tmdbVoteAverage ?? null,
    tmdb_vote_count: tmdbVoteCount ?? null,
  });

  const visibleTags = (tags ?? []).slice(0, 3);
  const overflowCount = (tags?.length ?? 0) - 3;

  const statusNode =
    statusOverride !== undefined
      ? statusOverride
      : statusLabel && statusClassName
        ? (
            <p className={`flex items-center gap-1.5 text-[15px] font-semibold ${statusClassName}`}>
              {showDoneIcon ? (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.2} />
              ) : null}
              <span>{statusLabel}</span>
            </p>
          )
        : null;

  return (
    <section className={`flex items-start gap-4 ${className ?? ""}`}>
      <MediaPosterLarge posterPath={posterPath} />

      <div className="min-w-0 flex-1 space-y-1.5 pt-1">
        <p className="text-[22px] font-bold leading-[1.2]">{title}</p>

        {metaLine ? <p className="text-[13px] leading-[1.35] text-text-2">{metaLine}</p> : null}

        {statusNode}

        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
          {ratingPicker ?? (personalRating !== undefined ? <PersonalRating rating={personalRating} /> : null)}
          {tmdbRating ? <TmdbRatingBadge rating={tmdbRating} /> : null}
        </div>

        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-lg border border-accent/25 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
              >
                {tag.name}
              </span>
            ))}
            {overflowCount > 0 ? (
              <span className="rounded-lg border border-border px-2 py-0.5 text-[11px] text-text-faint">
                +{overflowCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MediaPosterLarge({ posterPath }: { posterPath: string | null }) {
  return (
    <div className="flex aspect-[2/3] w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[5px] border-background bg-surface-muted shadow-sm">
      {posterPath ? (
        <Image
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          priority
          {...tmdbImage(posterPath, "detailPoster")}
        />
      ) : (
        <Film aria-hidden="true" className="h-8 w-8 text-text-faint" strokeWidth={1.8} />
      )}
    </div>
  );
}

export function PersonalRating({ rating }: { rating: number | null }) {
  return (
    <span
      className={[
        "inline-flex min-h-6 items-center gap-1.5 text-[15px] font-semibold",
        rating !== null ? "text-accent" : "text-text-muted",
      ].join(" ")}
      aria-label={rating !== null ? `Personal rating ${rating}` : "No personal rating"}
      title={rating !== null ? `Personal rating: ${rating}` : "No personal rating"}
    >
      <Heart
        aria-hidden="true"
        className={[
          "h-5 w-5 shrink-0",
          rating !== null ? "fill-accent/20 text-accent" : "text-text-muted",
        ].join(" ")}
        strokeWidth={1.8}
      />
      <span className="tabnum">{rating !== null ? rating : "-"}</span>
    </span>
  );
}

export function TmdbRatingBadge({ rating }: { rating: { value: number; voteCount: number | null } }) {
  const voteLabel = rating.voteCount
    ? ` from ${rating.voteCount.toLocaleString()} votes`
    : "";

  return (
    <span
      className="inline-flex h-6 max-w-full shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-border/60 bg-background px-2 align-middle text-[11px] font-medium leading-none"
      title={`TMDB rating: ${rating.value}${voteLabel}`}
      aria-label={`TMDB rating ${rating.value}${voteLabel}`}
    >
      <span className="text-[9px] font-bold uppercase tracking-wide text-text-2">
        TMDB
      </span>
      <span className="tabnum text-foreground">{rating.value}</span>
    </span>
  );
}
