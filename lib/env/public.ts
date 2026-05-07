import { readRequiredString, sharedEnv } from "@/lib/env/shared";

export const publicEnv = {
  ...sharedEnv,
  supabasePublishableKey: readRequiredString(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "Supabase publishable key",
  ),
} as const;
