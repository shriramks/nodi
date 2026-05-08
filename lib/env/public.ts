import { requireValue, sharedEnv } from "@/lib/env/shared";

export const publicEnv = {
  ...sharedEnv,
  supabasePublishableKey: requireValue(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "Supabase publishable key",
  ),
} as const;
