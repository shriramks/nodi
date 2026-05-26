"use server";

import { revalidatePath } from "next/cache";

import {
  bulkAttachTagToMovies,
  bulkCreateAndAttachTag,
  bulkDetachTagFromMovies,
  bulkSetWatchStatus,
  bulkUpdateRating,
} from "@/lib/db/mutations";
import { listTags } from "@/lib/db/queries";
import type { Tag } from "@/lib/db/types";

function revalidateLibrary() {
  revalidatePath("/library");
  revalidatePath("/wishlist");
  revalidatePath("/stats");
}

export async function bulkMarkWatchedAction(movieIds: string[]): Promise<void> {
  await bulkSetWatchStatus(movieIds, "watched");
  revalidateLibrary();
}

export async function bulkAddToWatchlistAction(movieIds: string[]): Promise<void> {
  await bulkSetWatchStatus(movieIds, "to_watch");
  revalidateLibrary();
}

export async function bulkUpdateRatingAction(
  movieIds: string[],
  rating: number | null,
): Promise<void> {
  await bulkUpdateRating(movieIds, { personalRating: rating });
  revalidateLibrary();
}

export async function bulkAddTagAction(movieIds: string[], tagName: string): Promise<void> {
  await bulkCreateAndAttachTag(movieIds, tagName);
  revalidateLibrary();
}

export async function bulkAttachTagByIdAction(movieIds: string[], tagId: string): Promise<void> {
  await bulkAttachTagToMovies(movieIds, tagId);
  revalidateLibrary();
}

export async function bulkDetachTagAction(movieIds: string[], tagId: string): Promise<void> {
  await bulkDetachTagFromMovies(movieIds, tagId);
  revalidateLibrary();
}

export async function listBulkActionTagsAction(): Promise<Tag[]> {
  return listTags();
}
