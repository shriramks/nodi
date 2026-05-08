import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import type { Provider } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listProviderConnections() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("provider_connections")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throwDatabaseError("Failed to load provider connections.", error);
  }

  return data ?? [];
}

export async function listSyncCursors(provider?: Provider) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("sync_cursors")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (provider) {
    query = query.eq("provider", provider);
  }

  const { data, error } = await query;

  if (error) {
    throwDatabaseError("Failed to load sync cursors.", error);
  }

  return data ?? [];
}

export async function listSyncEvents(limit = 25) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const cappedLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("sync_events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(cappedLimit);

  if (error) {
    throwDatabaseError("Failed to load sync events.", error);
  }

  return data ?? [];
}
