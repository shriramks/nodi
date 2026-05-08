import { Film } from "lucide-react";
import Link from "next/link";

type PosterCardProps = {
  movieId: string;
  title: string;
  posterPath: string | null;
};

const posterBaseUrl = "https://image.tmdb.org/t/p/w342";

export function PosterCard({ movieId, title, posterPath }: PosterCardProps) {
  return (
    <Link href={`/movie/${movieId}`} className="group block" aria-label={title}>
      <div
        className="flex aspect-[2/3] items-center justify-center rounded-2xl border border-border bg-surface-muted bg-cover bg-center transition-transform duration-200 group-hover:-translate-y-0.5"
        style={
          posterPath
            ? { backgroundImage: `url(${posterBaseUrl}${posterPath})` }
            : undefined
        }
      >
        {posterPath ? null : (
          <Film aria-hidden="true" className="h-7 w-7 text-text-faint" strokeWidth={1.8} />
        )}
      </div>
    </Link>
  );
}
