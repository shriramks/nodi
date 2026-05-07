"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env/public";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
  );

  return browserClient;
}
