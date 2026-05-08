import "server-only";

import { publicEnv } from "@/lib/env/public";
import { requireValue } from "@/lib/env/shared";

export const serverEnv = {
  ...publicEnv,
  supabaseSecretKey: requireValue(
    process.env.SUPABASE_SECRET_KEY,
    "SUPABASE_SECRET_KEY",
    "Supabase secret key",
  ),
  tmdbApiToken: requireValue(process.env.TMDB_API_TOKEN, "TMDB_API_TOKEN", "TMDB API token"),
  traktClientId: requireValue(process.env.TRAKT_CLIENT_ID, "TRAKT_CLIENT_ID", "Trakt client ID"),
  traktClientSecret: requireValue(
    process.env.TRAKT_CLIENT_SECRET,
    "TRAKT_CLIENT_SECRET",
    "Trakt client secret",
  ),
} as const;
