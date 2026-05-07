import type { Metadata } from "next";

const results = [
  { title: "Perfect Blue", meta: "1997 · ja · Already watched", tone: "text-watched" },
  { title: "Blue Velvet", meta: "1986 · en · Not in library", tone: "text-text-2" },
  { title: "Blue Giant", meta: "2023 · ja · To watch", tone: "text-to-watch" },
];

export const metadata: Metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-[32px] font-bold leading-none tracking-[-0.03em]">Search</h1>
        <p className="max-w-sm text-[13px] leading-5 text-text-2">
          Stubbed server-route search UI ready for TMDB-backed ingestion later.
        </p>
      </section>

      <section className="rounded-[24px] border border-border bg-surface px-4 py-3 shadow-[0_12px_32px_rgba(30,22,14,0.06)]">
        <input
          aria-label="Search movies"
          className="w-full bg-transparent text-[17px] text-foreground outline-none placeholder:text-text-muted"
          defaultValue="blue"
          placeholder="Search movies"
        />
      </section>

      <section className="space-y-2">
        {results.map((result) => (
          <article
            key={result.title}
            className="flex items-center gap-4 rounded-[24px] border border-border bg-surface p-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]"
          >
            <div className="aspect-[2/3] w-14 rounded-2xl bg-[linear-gradient(155deg,#151515_0%,#4b6cb7_100%)]" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-semibold">{result.title}</h2>
              <p className={`mt-1 text-[11px] ${result.tone}`}>{result.meta}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
