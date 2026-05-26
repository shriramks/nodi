"use server";

import { revalidatePath } from "next/cache";

import {
  ingestPreparedTmdbShow,
  setMediaShowStatus,
} from "@/lib/db/mutations";
import { AppError } from "@/lib/errors";
import type { TmdbShowIngestPayload } from "@/lib/providers/tmdb/adapters";

type ShowSaveStatus = "watching" | "wishlist";

function normalizeTmdbId(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError("Invalid TMDB show id.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return value;
}

function revalidateShowState(showId: string) {
  revalidatePath(`/show/${showId}`);
  revalidatePath("/library");
  revalidatePath("/wishlist");
  revalidatePath("/search");
}

export async function saveTmdbShowToLibraryAction(
  payload: TmdbShowIngestPayload,
): Promise<string> {
  const show = await saveTmdbShow(payload, "watching");
  revalidatePath("/library");
  return `/show/${show.id}`;
}

export async function addTmdbShowToWishlistAction(
  payload: TmdbShowIngestPayload,
): Promise<string> {
  const show = await saveTmdbShow(payload, "wishlist");
  revalidatePath("/wishlist");
  return `/show/${show.id}`;
}

export async function saveShowToLibraryAction(showId: string): Promise<void> {
  await setMediaShowStatus(showId, "watching");
  revalidateShowState(showId);
}

export async function addShowToWishlistAction(showId: string): Promise<void> {
  await setMediaShowStatus(showId, "wishlist");
  revalidateShowState(showId);
}

async function saveTmdbShow(payload: TmdbShowIngestPayload, status: ShowSaveStatus) {
  const tmdbId = normalizeTmdbId(payload.show.tmdbId);
  const show = await ingestPreparedTmdbShow(payload);

  await setMediaShowStatus(show.id, status);
  revalidatePath(`/show/tmdb/${tmdbId}`);
  revalidateShowState(show.id);

  return show;
}
