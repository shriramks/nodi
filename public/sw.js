/* global self, caches, fetch, URL, Request, Response */

const VERSION = "2026-05-09";
const PRECACHE = `nodi-precache-${VERSION}`;
const RUNTIME = `nodi-runtime-${VERSION}`;
const OFFLINE_URL = "/offline.html";

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
              .filter((key) => key !== PRECACHE && key !== RUNTIME)
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

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(event));
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

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cachedResponse = await caches.match(request);
  const freshResponse = fetchAndCache(request);

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

async function fetchAndCache(request) {
  try {
    const response = await fetch(request);

    if (isCacheable(response) && !request.headers.has("range")) {
      const cache = await caches.open(RUNTIME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return undefined;
  }
}

function isStaticAsset(request, url) {
  if (url.pathname.startsWith("/_next/static/")) {
    return true;
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

  return ["font", "image", "script", "style", "worker"].includes(
    request.destination,
  );
}

function isCacheable(response) {
  return (
    response &&
    response.status === 200 &&
    (response.type === "basic" || response.type === "default")
  );
}
