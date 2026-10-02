"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { TmdbImagePrefetcher } from "@/components/media/tmdb-image-prefetcher";
import { DiscoverCard } from "@/components/search/discover-card";
import { SectionScrollBleed } from "@/components/ui/section";
import { DISCOVER_RAIL_LABELS, type DiscoverRail } from "@/lib/media/discover-rails";
import type { MediaSearchResult } from "@/lib/providers/tmdb/adapters";
import { tmdbImagePrefetchUrls } from "@/lib/providers/tmdb/images";

type RailPayload = { rail: DiscoverRail; results: MediaSearchResult[] };

export function DiscoverRails() {
  const [rails, setRails] = useState<RailPayload[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    fetch("/api/search/discover", {
      signal: abortController.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        const payload = (await response.json()) as { rails?: RailPayload[]; error?: string };

        if (!response.ok || !payload.rails) {
          throw new Error(payload.error ?? "Could not load discover titles.");
        }

        setRails(payload.rails);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load discover titles.",
          );
        }
      });

    return () => abortController.abort();
  }, []);

  if (errorMessage) {
    return <p className="px-1 text-[13px] text-danger">{errorMessage}</p>;
  }

  if (!rails) {
    return <DiscoverRailsSkeleton />;
  }

  const prefetchUrls = tmdbImagePrefetchUrls(
    rails.flatMap((rail) =>
      rail.results.slice(0, 4).map((result) => ({ path: result.posterPath, role: "railPoster" })),
    ),
  );

  return (
    <div className="space-y-5">
      <TmdbImagePrefetcher urls={prefetchUrls} />
      {rails
        .filter((rail) => rail.results.length > 0)
        .map((rail) => (
          <section key={rail.rail}>
            <Link
              className="flex min-h-11 items-center justify-between active:opacity-70"
              href={`/search/discover/${rail.rail}`}
            >
              <h2 className="text-[20px] font-semibold leading-[1.2]">
                {DISCOVER_RAIL_LABELS[rail.rail]}
              </h2>
              <ChevronRight aria-hidden="true" className="h-5 w-5 text-accent" strokeWidth={2.2} />
            </Link>
            <SectionScrollBleed>
              <div className="flex gap-2.5">
                {rail.results.map((result) => (
                  <DiscoverCard
                    key={`${result.mediaType}:${result.tmdbId}`}
                    result={result}
                    variant="rail"
                  />
                ))}
              </div>
            </SectionScrollBleed>
          </section>
        ))}
    </div>
  );
}

function DiscoverRailsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5">
      {[0, 1, 2].map((index) => (
        <section key={index}>
          <div className="flex min-h-11 items-center">
            <div className="h-5 w-28 rounded-lg bg-surface-muted" />
          </div>
          <SectionScrollBleed>
            <div className="flex gap-2.5">
              {[0, 1, 2, 3].map((card) => (
                <div key={card} className="aspect-[2/3] w-28 shrink-0 rounded-2xl bg-surface-muted" />
              ))}
            </div>
          </SectionScrollBleed>
        </section>
      ))}
    </div>
  );
}
