import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nodi",
    short_name: "Nodi",
    description: "Track watched movies, manage your watchlist, and keep personal movie stats.",
    start_url: "/movies",
    display: "standalone",
    background_color: "#f6f1e8",
    theme_color: "#f6f1e8",
  };
}
