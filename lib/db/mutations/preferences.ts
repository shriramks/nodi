import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserPreferences } from "@/lib/db/types";

type PreferencesUpdate = Partial<Pick<UserPreferences, "co_watch_tag" | "theme">>;

export async function upsertUserPreferences(update: PreferencesUpdate): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("user_preferences").upsert(
    { user_id: user.id, ...update },
    { onConflict: "user_id" },
  );

  if (error) {
    throwDatabaseError("Failed to save preferences.", error);
  }
}
