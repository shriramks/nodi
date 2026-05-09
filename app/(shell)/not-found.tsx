import Link from "next/link";
import { Film, Search } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";

export default function ShellNotFound() {
  return (
    <main className="space-y-6">
      <section>
        <BackButton />
        <h1 className="mt-2 text-[32px] font-bold leading-[1.1]">Not found</h1>
        <p className="mt-2 text-[15px] leading-[1.4] text-text-2">
          This movie or page is not available.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent"
          href="/search"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          Search
        </Link>
        <Link
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-foreground"
          href="/movies"
        >
          <Film aria-hidden="true" className="h-4 w-4" />
          Movies
        </Link>
      </section>
    </main>
  );
}
