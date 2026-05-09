import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Nodi",
    short_name: "Nodi",
    description: "Track watched movies, manage your watchlist, and keep personal movie stats.",
    lang: "en",
    dir: "ltr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#F2F2F7",
    theme_color: "#F2F2F7",
    categories: ["entertainment", "productivity"],
    launch_handler: {
      client_mode: "focus-existing",
    },
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-1024.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/nodi-mobile.svg",
        sizes: "390x844",
        type: "image/svg+xml",
        form_factor: "narrow",
        label: "Nodi mobile movie library",
      },
      {
        src: "/screenshots/nodi-wide.svg",
        sizes: "1440x900",
        type: "image/svg+xml",
        form_factor: "wide",
        label: "Nodi movie stats and watchlist",
      },
    ],
    shortcuts: [
      {
        name: "Movies",
        short_name: "Movies",
        description: "Open your watched movie library.",
        url: "/movies",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "To Watch",
        short_name: "Watchlist",
        description: "Open your queued movies.",
        url: "/to-watch",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Search",
        short_name: "Search",
        description: "Find movies to save.",
        url: "/search",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
