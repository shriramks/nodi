"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  MovieSearchResponse,
  MovieSearchResult,
} from "@/lib/providers/tmdb/adapters";

type SearchStatus = "idle" | "loading" | "success" | "error";

const posterBaseUrl = "https://image.tmdb.org/t/p/w185";
const minimumQueryLength = 2;

export function MovieSearch() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<MovieSearchResponse | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const normalizedQuery = useMemo(() => query.replace(/\s+/g, " ").trim(), [query]);

  useEffect(() => {
    if (normalizedQuery.length < minimumQueryLength) {
      return;
    }

    const abortController = new AbortController();
    const timeout = window.setTimeout(() => {
      setStatus("loading");
      setErrorMessage(null);

      fetch(`/api/search/movies?q=${encodeURIComponent(normalizedQuery)}`, {
        signal: abortController.signal,
        headers: {
          accept: "application/json",
        },
      })
        .then(async (searchResponse) => {
          const payload = (await searchResponse.json()) as
            | MovieSearchResponse
            | { error?: string };

          if (!searchResponse.ok) {
            throw new Error(
              "error" in payload ? (payload.error ?? "Search failed.") : "Search failed.",
            );
          }

          return payload as MovieSearchResponse;
        })
        .then((payload) => {
          setResponse(payload);
          setStatus("success");
        })
        .catch((error: unknown) => {
          if (abortController.signal.aborted) {
            return;
          }

          setResponse(null);
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "Search failed.");
        });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [normalizedQuery]);

  const activeResponse = response?.query === normalizedQuery ? response : null;
  const activeStatus = normalizedQuery.length < minimumQueryLength ? "idle" : status;
  const results = activeResponse?.results ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-border bg-surface px-4 py-3 shadow-[0_12px_32px_rgba(30,22,14,0.06)]">
        <input
          aria-label="Search movies"
          className="w-full bg-transparent text-[17px] text-foreground outline-none placeholder:text-text-muted"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search movies"
          type="search"
          value={query}
        />
      </section>

      {activeStatus === "loading" ? (
        <p className="px-1 text-[13px] text-text-2">Searching...</p>
      ) : null}

      {activeStatus === "error" ? (
        <p className="px-1 text-[13px] text-danger">{errorMessage ?? "Search failed."}</p>
      ) : null}

      {activeStatus === "success" && results.length === 0 ? (
        <p className="px-1 text-[13px] text-text-2">No movies found.</p>
      ) : null}

      <section className="space-y-2">
        {results.map((result) => (
          <SearchResultRow key={result.tmdbId} result={result} />
        ))}
      </section>
    </div>
  );
}

function SearchResultRow({ result }: { result: MovieSearchResult }) {
  const meta = [
    result.releaseYear,
    result.originalLanguage,
    result.currentStatus === "watched"
      ? "Watched"
      : result.currentStatus === "to_watch"
        ? "To watch"
        : result.localMovieId
          ? "In metadata"
          : "Not in library",
  ]
    .filter(Boolean)
    .join(" · ");
  const statusTone =
    result.currentStatus === "watched"
      ? "text-watched"
      : result.currentStatus === "to_watch"
        ? "text-to-watch"
        : "text-text-2";

  return (
    <a
      className="flex items-center gap-4 rounded-[24px] border border-border bg-surface p-3 shadow-[0_12px_32px_rgba(30,22,14,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
      href={result.detailUrl}
    >
      <div
        aria-hidden="true"
        className="aspect-[2/3] w-14 shrink-0 rounded-2xl bg-surface-muted bg-cover bg-center"
        style={
          result.posterPath
            ? { backgroundImage: `url(${posterBaseUrl}${result.posterPath})` }
            : undefined
        }
      />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[17px] font-semibold">{result.title}</h2>
        <p className={`mt-1 truncate text-[11px] ${statusTone}`}>{meta || "Movie"}</p>
        {result.overviewSnippet ? (
          <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-text-2">
            {result.overviewSnippet}
          </p>
        ) : null}
      </div>
    </a>
  );
}
