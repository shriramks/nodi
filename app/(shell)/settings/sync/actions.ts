"use server";

import { revalidatePath } from "next/cache";

import {
  disconnectCurrentUserTrakt,
  saveCurrentUserTraktAppCredentials,
} from "@/lib/providers/trakt/credentials";
import {
  disconnectCurrentUserTmdb,
  saveCurrentUserTmdbApiToken,
} from "@/lib/providers/tmdb/credentials";

export async function saveTraktCredentialsAction(formData: FormData) {
  await saveCurrentUserTraktAppCredentials({
    clientId: String(formData.get("clientId") ?? ""),
    clientSecret: String(formData.get("clientSecret") ?? ""),
  });
  revalidateSettings();
}

export async function disconnectTraktAction() {
  await disconnectCurrentUserTrakt();
  revalidateSettings();
}

export async function saveTmdbTokenAction(formData: FormData) {
  await saveCurrentUserTmdbApiToken(String(formData.get("apiToken") ?? ""));
  revalidateSettings();
}

export async function disconnectTmdbAction() {
  await disconnectCurrentUserTmdb();
  revalidateSettings();
}

function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/settings/sync");
  revalidatePath("/settings/sync/trakt");
  revalidatePath("/settings/sync/tmdb");
  revalidatePath("/movies");
  revalidatePath("/search");
}
