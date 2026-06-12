export type TmdbImageSize = "w185" | "w342" | "w780";

export function tmdbImageUrl(path: string, size: TmdbImageSize) {
  return `https://image.tmdb.org/t/p/${size}${normalizeTmdbPath(path)}`;
}

export type TmdbImageRole =
  | "gridPoster"
  | "railPoster"
  | "detailPoster"
  | "searchPoster"
  | "heroBackdrop"
  | "profileAvatar"
  | "profilePortrait";

type TmdbImageSpec = {
  height: number;
  tmdbSize: TmdbImageSize;
  width: number;
};

export const tmdbImageSpecs = {
  gridPoster: {
    height: 278,
    tmdbSize: "w185",
    width: 185,
  },
  railPoster: {
    height: 513,
    tmdbSize: "w342",
    width: 342,
  },
  detailPoster: {
    height: 513,
    tmdbSize: "w342",
    width: 342,
  },
  searchPoster: {
    height: 278,
    tmdbSize: "w185",
    width: 185,
  },
  heroBackdrop: {
    height: 439,
    tmdbSize: "w780",
    width: 780,
  },
  profileAvatar: {
    height: 278,
    tmdbSize: "w185",
    width: 185,
  },
  profilePortrait: {
    height: 513,
    tmdbSize: "w342",
    width: 342,
  },
} satisfies Record<TmdbImageRole, TmdbImageSpec>;

export type TmdbImageDescriptor = {
  height: number;
  src: string;
  width: number;
};

export type TmdbImagePrefetchInput = {
  path: string | null | undefined;
  role: TmdbImageRole;
};

export function tmdbImage(path: string, role: TmdbImageRole): TmdbImageDescriptor {
  const spec = tmdbImageSpecs[role];

  return {
    height: spec.height,
    src: tmdbImageUrl(path, spec.tmdbSize),
    width: spec.width,
  };
}

export function tmdbImagePrefetchUrls(
  images: TmdbImagePrefetchInput[],
  limit = 16,
) {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const image of images) {
    if (!image.path) {
      continue;
    }

    const url = tmdbImageUrl(image.path, tmdbImageSpecs[image.role].tmdbSize);

    if (seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);

    if (urls.length >= limit) {
      break;
    }
  }

  return urls;
}

function normalizeTmdbPath(path: string) {
  const trimmed = path.trim();

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
