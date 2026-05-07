import "server-only";

import { publicEnv } from "@/lib/env/public";
import { readRequiredString } from "@/lib/env/shared";

export const serverEnv = {
  ...publicEnv,
  supabaseSecretKey: readRequiredString(
    "SUPABASE_SECRET_KEY",
    "Supabase secret key",
  ),
  tmdbApiToken: readRequiredString("TMDB_API_TOKEN", "TMDB API token"),
  traktClientId: readRequiredString("TRAKT_CLIENT_ID", "Trakt client ID"),
  traktClientSecret: readRequiredString(
    "TRAKT_CLIENT_SECRET",
    "Trakt client secret",
  ),
} as const;
