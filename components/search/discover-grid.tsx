"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DiscoverCard } from "@/components/search/discover-card";
import type { DiscoverRail, DiscoverType } from "@/lib/media/discover-rails";
import type { MediaSearchResult } from "@/lib/providers/tmdb/adapters";

const typeOptions: { label: string; value: DiscoverType }[] = [
  { label: "All", value: "all" },
  { label: "Movies", value: "movie" },
  { label: "Shows", value: "show" },
];

type GridState = {
  key: string;
  page: number;
  results: MediaSearchResult[];
  totalPages: number;
  status: "loading" | "ready" | "error";
  errorMessage: string | null;
};

export function DiscoverGrid({ rail }: { rail: DiscoverRail }) {
  const [type, setType] = useState<DiscoverType>("all");
  const [state, setState] = useState<GridState>({
    key: `${rail}:all`,
    page: 0,
    results: [],
    totalPages: 1,
    status: "loading",
    errorMessage: null,
  });
  const [requestedPage, setRequestedPage] = useState(1);
  const stateKey = `${rail}:${type}`;
  const loadedKeyRef = useRef(stateKey);

  useEffect(() => {
    const abortController = new AbortController();
    const isNewList = loadedKeyRef.current !== stateKey;

    loadedKeyRef.current = stateKey;
    fetch(`/api/search/discover?rail=${rail}&type=${type}&page=${requestedPage}`, {
      signal: abortController.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          results?: MediaSearchResult[];
          totalPages?: number;
          error?: string;
        };

        if (!response.ok || !payload.results) {
          throw new Error(payload.error ?? "Could not load titles.");
        }

        setState((current) => {
          const seen = new Set(
            (isNewList || current.key !== stateKey ? [] : current.results).map(resultKey),
          );
          const fresh = payload.results!.filter((result) => !seen.has(resultKey(result)));

          return {
            key: stateKey,
            page: requestedPage,
            results:
              isNewList || current.key !== stateKey ? fresh : [...current.results, ...fresh],
            totalPages: payload.totalPages ?? 1,
            status: "ready",
            errorMessage: null,
          };
        });
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          setState((current) => ({
            ...current,
            status: "error",
            errorMessage: error instanceof Error ? error.message : "Could not load titles.",
          }));
        }
      });

    return () => abortController.abort();
  }, [rail, requestedPage, stateKey, type]);

  const isCurrent = state.key === stateKey;
  const results = isCurrent ? state.results : [];
  const isLoading = !isCurrent || state.status === "loading";
  const hasMore = isCurrent && state.page < state.totalPages;

  function selectType(next: DiscoverType) {
    if (next === type) return;

    setType(next);
    setRequestedPage(1);
    setState((current) => ({ ...current, status: "loading", errorMessage: null }));
  }

  function loadMore() {
    setState((current) => ({ ...current, status: "loading" }));
    setRequestedPage(state.page + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5" role="group" aria-label="Type">
        {typeOptions.map((option) => (
          <button
            aria-pressed={type === option.value}
            className={`flex h-9 items-center rounded-full px-3.5 text-[15px] active:opacity-70 ${
              type === option.value
                ? "bg-accent/15 font-semibold text-accent"
                : "border border-border bg-surface text-text-2"
            }`}
            key={option.value}
            onClick={() => selectType(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {isCurrent && state.status === "error" ? (
        <p className="px-1 text-[13px] text-danger">{state.errorMessage ?? "Could not load titles."}</p>
      ) : null}

      <section className="grid grid-cols-3 gap-2.5">
        {results.map((result) => (
          <DiscoverCard key={resultKey(result)} result={result} variant="grid" />
        ))}
      </section>

      {isLoading && state.status !== "error" ? (
        <div className="flex justify-center py-4" role="status" aria-label="Loading">
          <LoaderCircle className="h-5 w-5 animate-spin text-text-muted" strokeWidth={2.2} />
        </div>
      ) : null}

      {!isLoading && hasMore ? (
        <button
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-surface-muted text-[15px] font-semibold text-accent active:opacity-70"
          onClick={loadMore}
          type="button"
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}

function resultKey(result: MediaSearchResult) {
  return `${result.mediaType}:${result.tmdbId}`;
}
