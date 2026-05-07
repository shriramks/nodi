import type { Metadata } from "next";

type MovieDetailPageProps = {
  params: Promise<{
    movieId: string;
  }>;
};

export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  const { movieId } = await params;

  return {
    title: `Movie ${movieId}`,
  };
}

export default async function MovieDetailPage({ params }: MovieDetailPageProps) {
  const { movieId } = await params;

  return (
    <main className="space-y-6">
      <section className="space-y-4">
        <div className="aspect-[4/5] w-full rounded-[28px] bg-[linear-gradient(140deg,#1f2630_0%,#88514c_100%)]" />
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-text-faint">Movie detail</p>
          <h1 className="text-[32px] font-bold leading-none tracking-[-0.03em]">Local movie ID</h1>
          <p className="break-all font-mono text-[13px] text-text-2">{movieId}</p>
        </div>
      </section>

      <section className="rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]">
        <p className="text-[15px] leading-7 text-text-2">
          This route is the scaffolded destination for post-ingestion movie detail data from TMDB and
          Supabase.
        </p>
      </section>
    </main>
  );
}
