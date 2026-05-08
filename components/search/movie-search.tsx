"use client";

import { Film, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type {
  MovieSearchResponse,
  MovieSearchResult,
} from "@/lib/providers/tmdb/adapters";

type SearchStatus = "idle" | "loading" | "success" | "error";

type IngestMovieResponse = {
  movieId: string;
  tmdbId: number;
  detailUrl: string;
};

const posterBaseUrl = "https://image.tmdb.org/t/p/w185";
const minimumQueryLength = 2;

export function MovieSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<MovieSearchResponse | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectionErrorMessage, setSelectionErrorMessage] = useState<string | null>(null);
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
      setSelectionErrorMessage(null);

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

  async function openMovie(result: MovieSearchResult) {
    if (openingTmdbId !== null) {
      return;
    }

    setOpeningTmdbId(result.tmdbId);
    setSelectionErrorMessage(null);

    if (result.localMovieId) {
      router.push(`/movie/${result.localMovieId}`);
      return;
    }

    try {
      const ingestResponse = await fetch(result.detailUrl, {
        headers: {
          accept: "application/json",
        },
      });
      const payload = (await ingestResponse.json()) as IngestMovieResponse | { error?: string };

      if (!ingestResponse.ok) {
        throw new Error(
          "error" in payload ? (payload.error ?? "Failed to open movie.") : "Failed to open movie.",
        );
      }

      router.push((payload as IngestMovieResponse).detailUrl);
      router.refresh();
    } catch (error) {
      setOpeningTmdbId(null);
      setSelectionErrorMessage(error instanceof Error ? error.message : "Failed to open movie.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex h-[50px] items-center gap-3 rounded-xl border border-border bg-surface-muted px-4">
        <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-text-muted" />
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

      {selectionErrorMessage ? (
        <p className="px-1 text-[13px] text-danger">{selectionErrorMessage}</p>
      ) : null}

      {activeStatus === "success" && results.length === 0 ? (
        <p className="px-1 text-[13px] text-text-2">No movies found.</p>
      ) : null}

      {results.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          {results.map((result) => (
            <SearchResultRow
              key={result.tmdbId}
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

function SearchResultRow({
  isOpening,
  onOpen,
  result,
}: {
  isOpening: boolean;
  onOpen: (result: MovieSearchResult) => void;
  result: MovieSearchResult;
}) {
  const localStateLabel =
    result.currentStatus === "watched"
      ? "Already watched"
      : result.currentStatus === "to_watch"
        ? "To watch"
        : result.localMovieId
          ? "Available locally"
          : "Not in library";
  const meta = [
    result.releaseYear,
    result.originalLanguage,
    localStateLabel,
    result.personalRating !== null ? `${result.personalRating}/10` : null,
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
    <button
      className="flex min-h-12 w-full items-center gap-4 border-b border-divider px-4 py-3 text-left last:border-b-0 hover:bg-tap-active disabled:cursor-wait disabled:opacity-70"
      disabled={isOpening}
      onClick={() => onOpen(result)}
      type="button"
    >
      <div
        aria-hidden="true"
        className="flex aspect-[2/3] w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-muted bg-cover bg-center"
        style={
          result.posterPath
            ? { backgroundImage: `url(${posterBaseUrl}${result.posterPath})` }
            : undefined
        }
      >
        {result.posterPath ? null : (
          <Film className="h-5 w-5 text-text-faint" strokeWidth={1.8} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[17px] font-semibold">{result.title}</h2>
        <p className={`mt-1 truncate text-[11px] ${statusTone}`}>
          {isOpening ? "Opening..." : meta || "Movie"}
        </p>
      </div>
    </button>
  );
}
