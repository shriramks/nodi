/* global self, caches, fetch, URL, Request, Response */

const VERSION = "2026-05-26-1";
const PRECACHE = `nodi-precache-${VERSION}`;
const RUNTIME = `nodi-runtime-${VERSION}`;
const IMAGE_RUNTIME = `nodi-images-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const MAX_IMAGE_CACHE_ENTRIES = 160;
const inFlightFetches = new Map();

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/apple-touch-icon.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-1024.png",
  "/screenshots/nodi-mobile.svg",
  "/screenshots/nodi-wide.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.map(
            (url) => new Request(url, { cache: "reload" }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== PRECACHE && key !== RUNTIME && key !== IMAGE_RUNTIME)
              .map((key) => caches.delete(key)),
          ),
        ),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isOptimizedImageRequest(url) || isTmdbImageRequest(url)) {
    event.respondWith(
      staleWhileRevalidate(event, {
        cacheName: IMAGE_RUNTIME,
        maxEntries: MAX_IMAGE_CACHE_ENTRIES,
      }),
    );
    return;
  }

  if (!isSameOrigin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (isStaticAsset(request, url)) {
    const isImage = request.destination === "image";

    event.respondWith(
      staleWhileRevalidate(event, {
        cacheName: isImage ? IMAGE_RUNTIME : RUNTIME,
        maxEntries: isImage ? MAX_IMAGE_CACHE_ENTRIES : undefined,
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "NODI_PREFETCH_IMAGES") {
    return;
  }

  const urls = normalizePrefetchUrls(event.data.urls);

  if (urls.length === 0) {
    return;
  }

  const prefetch = prefetchImages(urls);

  if (typeof event.waitUntil === "function") {
    event.waitUntil(prefetch);
  }
});

async function handleNavigation(event) {
  try {
    const preloadResponse = await event.preloadResponse;

    if (preloadResponse) {
      return preloadResponse;
    }

    return await fetch(event.request);
  } catch {
    const cachedOfflineShell = await caches.match(OFFLINE_URL, {
      ignoreSearch: true,
    });

    return (
      cachedOfflineShell ||
      new Response("Nodi is offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function staleWhileRevalidate(event, options = {}) {
  const { request } = event;
  const { cacheName = RUNTIME, maxEntries } = options;
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  const freshResponse = fetchAndCache(request, cacheName, maxEntries);

  if (cachedResponse) {
    event.waitUntil(freshResponse);
    return cachedResponse;
  }

  return (
    (await freshResponse) ||
    new Response("This asset is unavailable offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  );
}

async function fetchAndCache(request, cacheName = RUNTIME, maxEntries) {
  const key = request.url;

  if (inFlightFetches.has(key)) {
    const inFlightResponse = await inFlightFetches.get(key);
    return inFlightResponse?.clone();
  }

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (isCacheable(response) && !request.headers.has("range")) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());

        if (maxEntries) {
          await trimCache(cache, maxEntries);
        }
      }

      return response;
    })
    .catch(() => undefined)
    .finally(() => {
      inFlightFetches.delete(key);
    });

  inFlightFetches.set(key, fetchPromise);

  const response = await fetchPromise;
  return response?.clone();
}

function isStaticAsset(request, url) {
  if (url.pathname.startsWith("/_next/static/")) {
    return request.destination === "font" || request.destination === "image";
  }

  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/screenshots/")
  ) {
    return true;
  }

  if (
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/icon.png" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    return true;
  }

  return ["font", "image"].includes(request.destination);
}

function isCacheable(response) {
  return (
    response &&
    (response.status === 200 || response.type === "opaque") &&
    (response.type === "basic" ||
      response.type === "cors" ||
      response.type === "default" ||
      response.type === "opaque")
  );
}

async function prefetchImages(urls) {
  const queue = [...urls];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      const request = new Request(url, {
        cache: "reload",
        credentials: "same-origin",
      });

      const cache = await caches.open(IMAGE_RUNTIME);
      const cachedResponse = await cache.match(request);

      if (!cachedResponse) {
        await fetchAndCache(request, IMAGE_RUNTIME, MAX_IMAGE_CACHE_ENTRIES);
      }
    }
  });

  await Promise.all(workers);
}

function normalizePrefetchUrls(urls) {
  if (!Array.isArray(urls)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  for (const value of urls) {
    if (typeof value !== "string") {
      continue;
    }

    try {
      const url = new URL(value, self.location.origin);

      if (!isOptimizedImageRequest(url) && !isTmdbImageRequest(url)) {
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

  return normalized.slice(0, 32);
}

function isOptimizedImageRequest(url) {
  return url.origin === self.location.origin && url.pathname === "/_next/image";
}

function isTmdbImageRequest(url) {
  return (
    url.origin === "https://image.tmdb.org" &&
    url.pathname.startsWith("/t/p/")
  );
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();

  if (keys.length <= maxEntries) {
    return;
  }

  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}
