"use client";

import Link from "next/link";
import { Home, RefreshCcw } from "lucide-react";

export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-[32px] font-bold leading-[1.1]">Something went wrong</h1>
        <p className="mt-2 text-[15px] leading-[1.4] text-text-2">
          {error.message || "The page could not be loaded."}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent"
          onClick={reset}
          type="button"
        >
          <RefreshCcw aria-hidden="true" className="h-4 w-4" />
          Retry
        </button>
        <Link
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-foreground"
          href="/movies"
        >
          <Home aria-hidden="true" className="h-4 w-4" />
          Movies
        </Link>
      </section>
    </main>
  );
}
