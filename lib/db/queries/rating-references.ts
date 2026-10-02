import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MIN_SELECTABLE_RATING } from "@/lib/media/rating-scale";
import { pickRatingReferences, type RatedTitleRow } from "./rating-references-transforms";

const pageSize = 1000;

export async function getRatingReferences(excludeIds: string[]) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const rows: RatedTitleRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("user_media")
      .select("media_id, personal_rating, media_items!inner(title)")
      .eq("user_id", user.id)
      .gte("personal_rating", MIN_SELECTABLE_RATING)
      .order("media_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throwDatabaseError("Failed to load rating references.", error);
    }

    rows.push(...((data ?? []) as unknown as RatedTitleRow[]));
    if (!data || data.length < pageSize) break;
  }

  return pickRatingReferences(rows, new Set(excludeIds));
}
