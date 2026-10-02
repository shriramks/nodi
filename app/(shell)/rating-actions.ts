"use server";

import { getRatingReferences } from "@/lib/db/queries";
import { validateUuid } from "@/lib/db/validation";

// Called each time a rating sheet opens, so the reference titles are re-rolled every time.
export async function getRatingReferencesAction(excludeIds: string[]): Promise<Record<number, string>> {
  return getRatingReferences(excludeIds.map((id) => validateUuid(id, "media id")));
}
