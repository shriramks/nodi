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
} as const;
