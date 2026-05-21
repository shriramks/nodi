"use client";

import { Film, LoaderCircle, Search, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TmdbImagePrefetcher } from "@/components/media/tmdb-image-prefetcher";
import type {
  MovieSearchResponse,
  MovieSearchResult,
} from "@/lib/providers/tmdb/adapters";
import { tmdbImage, tmdbImagePrefetchUrls } from "@/lib/providers/tmdb/images";

type SearchStatus = "idle" | "loading" | "success" | "error";

const minimumQueryLength = 2;

export function MovieSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<MovieSearchResponse | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openingTmdbId, setOpeningTmdbId] = useState<number | null>(null);
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
  const prefetchUrls = tmdbImagePrefetchUrls(
    results.map((result) => ({
      path: result.posterPath,
      role: "searchPoster",
    })),
  );

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);

    if (nextQuery.replace(/\s+/g, " ").trim().length < minimumQueryLength) {
      setResponse(null);
      setStatus("idle");
      setErrorMessage(null);
    }
  }

  function clearSearch() {
    handleQueryChange("");
  }

  async function openMovie(result: MovieSearchResult) {
    if (openingTmdbId !== null) {
      return;
    }

    setOpeningTmdbId(result.tmdbId);

    router.push(result.localMovieId ? `/movie/${result.localMovieId}` : result.detailUrl);
  }

  return (
    <div className="space-y-5">
      <TmdbImagePrefetcher urls={prefetchUrls} />
      <section className="flex h-[50px] items-center gap-3 rounded-xl border border-border bg-surface-muted pl-4 pr-1">
        <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-text-muted" />
        <input
          aria-label="Search movies"
          className="min-w-0 flex-1 appearance-none bg-transparent text-[17px] text-foreground outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Search movies"
          type="search"
          value={query}
        />
        {activeStatus === "loading" ? (
          <span
            aria-label="Searching movies"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted"
            role="status"
          >
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" strokeWidth={2.2} />
          </span>
        ) : null}
        {query.length > 0 ? (
          <button
            aria-label="Clear search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-tap-active hover:text-foreground"
            onClick={clearSearch}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.2} />
          </button>
        ) : null}
      </section>

      {activeStatus === "error" ? (
        <p className="px-1 text-[13px] text-danger">{errorMessage ?? "Search failed."}</p>
      ) : null}

      {activeStatus === "success" && results.length === 0 ? (
        <p className="px-1 text-[13px] text-text-2">No movies found.</p>
      ) : null}

      {results.length > 0 ? (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
          {results.map((result) => (
            <SearchResultPoster
              key={result.tmdbId}
              isDisabled={openingTmdbId !== null}
              isOpening={openingTmdbId === result.tmdbId}
              onOpen={openMovie}
              result={result}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function SearchResultPoster({
  isDisabled,
  isOpening,
  onOpen,
  result,
}: {
  isDisabled: boolean;
  isOpening: boolean;
  onOpen: (result: MovieSearchResult) => void;
  result: MovieSearchResult;
}) {
  const localStateLabel =
    result.currentStatus === "watched"
      ? "Already watched"
      : result.currentStatus === "to_watch"
        ? "To watch"
        : "Not saved";
  const ariaLabel = [
    result.title,
    result.releaseYear,
    localStateLabel,
    result.personalRating !== null ? `${result.personalRating}/10` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      aria-label={isOpening ? `Opening ${result.title}` : ariaLabel}
      aria-busy={isOpening}
      className="group block min-w-0 text-left disabled:cursor-wait disabled:opacity-70"
      disabled={isDisabled}
      onClick={() => onOpen(result)}
      type="button"
    >
      <div
        aria-hidden="true"
        className="relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-muted transition-transform duration-200 group-hover:-translate-y-0.5"
      >
        {result.posterPath ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            {...tmdbImage(result.posterPath, "searchPoster")}
          />
        ) : (
          <Film className="h-5 w-5 text-text-faint" strokeWidth={1.8} />
        )}
        {isOpening ? (
          <span className="absolute inset-0 flex items-center justify-center bg-surface/72">
            <LoaderCircle className="h-5 w-5 animate-spin text-foreground" strokeWidth={2.2} />
          </span>
        ) : null}
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold leading-tight text-foreground">
        {result.title}
      </p>
    </button>
  );
}
