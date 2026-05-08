import Link from "next/link";

type PosterCardProps = {
  movieId: string;
  title: string;
  year: string;
  tone: string;
};

export function PosterCard({ movieId, title, year, tone }: PosterCardProps) {
  return (
    <Link href={`/movie/${movieId}`} className="group block">
      <div
        className={`aspect-[2/3] rounded-[24px] bg-linear-to-b ${tone} p-3 shadow-[0_14px_32px_rgba(22,14,8,0.16)] transition-transform duration-200 group-hover:-translate-y-1`}
      >
        <div className="flex h-full flex-col justify-between rounded-[18px] border border-white/20 bg-black/10 p-3 text-white">
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/75">{year}</span>
          <h2 className="text-[17px] font-semibold leading-tight">{title}</h2>
        </div>
      </div>
    </Link>
  );
}
