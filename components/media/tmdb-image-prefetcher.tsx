"use client";

import { useEffect } from "react";

const maxUrlsPerMount = 24;
const prefetchedUrls = new Set<string>();
const pendingUrls = new Set<string>();

type ConnectionInfo = {
  effectiveType?: string;
  saveData?: boolean;
};

export function TmdbImagePrefetcher({ urls }: { urls: string[] }) {
  useEffect(() => {
    if (urls.length === 0 || shouldSkipPrefetch()) {
      return;
    }

    const nextUrls = normalizePrefetchUrls(urls)
      .filter((url) => !prefetchedUrls.has(url) && !pendingUrls.has(url))
      .slice(0, maxUrlsPerMount);

    if (nextUrls.length === 0) {
      return;
    }

    for (const url of nextUrls) {
      prefetchedUrls.add(url);
    }

    const controller = navigator.serviceWorker?.controller;

    if (controller) {
      controller.postMessage({
        type: "NODI_PREFETCH_IMAGES",
        urls: nextUrls,
      });
      return;
    }

    const abortController = new AbortController();
    const timeout = window.setTimeout(() => {
      void prefetchInBrowser(nextUrls, abortController.signal);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [urls]);

  return null;
}

function normalizePrefetchUrls(urls: string[]) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawUrl of urls) {
    try {
      const url = new URL(rawUrl, window.location.origin);

      if (url.origin !== "https://image.tmdb.org" || !url.pathname.startsWith("/t/p/")) {
        continue;
      }

      const href = url.href;

      if (!seen.has(href)) {
        seen.add(href);
        normalized.push(href);
      }
    } catch {
      continue;
    }
  }

  return normalized;
}

async function prefetchInBrowser(urls: string[], signal: AbortSignal) {
  for (const url of urls) {
    if (signal.aborted) {
      return;
    }

    pendingUrls.add(url);

    try {
      await fetch(url, {
        cache: "force-cache",
        credentials: "same-origin",
        signal,
      });
    } catch {
      prefetchedUrls.delete(url);
    } finally {
      pendingUrls.delete(url);
    }
  }
}

function shouldSkipPrefetch() {
  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
  const effectiveType = connection?.effectiveType;

  return (
    connection?.saveData === true ||
    effectiveType === "slow-2g" ||
    effectiveType === "2g"
  );
}
