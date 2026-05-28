import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import type { Tag } from "@/lib/db/types";
import { validateTagPayload } from "@/lib/db/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function upsertTag(payload: unknown): Promise<Tag> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const tag = validateTagPayload(payload);

  const { data, error } = await supabase
    .from("tags")
    .upsert(
      {
        user_id: user.id,
        name: tag.name,
        normalized_name: normalizeTagName(tag.name),
      },
      { onConflict: "user_id,normalized_name" },
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to upsert tag.", error);
  }

  return data;
}
