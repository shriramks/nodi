import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nodi",
    short_name: "Nodi",
    description: "Track watched movies, manage your watchlist, and keep personal movie stats.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F2F7",
    theme_color: "#F2F2F7",
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
        purpose: "maskable",
      },
    ],
  };
}
