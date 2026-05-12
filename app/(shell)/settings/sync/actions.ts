"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAppError } from "@/lib/errors";
import {
  disconnectCurrentUserTrakt,
  saveCurrentUserTraktAppCredentials,
} from "@/lib/providers/trakt/credentials";
import {
  disconnectCurrentUserTmdb,
  saveCurrentUserTmdbApiToken,
} from "@/lib/providers/tmdb/credentials";

const traktSettingsPath = "/settings/sync/trakt";
const tmdbSettingsPath = "/settings/sync/tmdb";

export async function saveTraktCredentialsAction(formData: FormData) {
  let targetPath = traktSettingsPath;

  try {
    await saveCurrentUserTraktAppCredentials({
      clientId: String(formData.get("clientId") ?? ""),
      clientSecret: String(formData.get("clientSecret") ?? ""),
    });
    revalidateSettings();
  } catch (error) {
    targetPath = settingsActionErrorPath(traktSettingsPath, "save Trakt credentials", error);
  }

  redirect(targetPath);
}

export async function disconnectTraktAction() {
  let targetPath = traktSettingsPath;

  try {
    await disconnectCurrentUserTrakt();
    revalidateSettings();
  } catch (error) {
    targetPath = settingsActionErrorPath(traktSettingsPath, "disconnect Trakt", error);
  }

  redirect(targetPath);
}

export async function saveTmdbTokenAction(formData: FormData) {
  let targetPath = tmdbSettingsPath;

  try {
    await saveCurrentUserTmdbApiToken(String(formData.get("apiToken") ?? ""));
    revalidateSettings();
  } catch (error) {
    targetPath = settingsActionErrorPath(tmdbSettingsPath, "save TMDB token", error);
  }

  redirect(targetPath);
}

export async function disconnectTmdbAction() {
  let targetPath = tmdbSettingsPath;

  try {
    await disconnectCurrentUserTmdb();
    revalidateSettings();
  } catch (error) {
    targetPath = settingsActionErrorPath(tmdbSettingsPath, "disconnect TMDB", error);
  }

  redirect(targetPath);
}

function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/settings/sync");
  revalidatePath("/settings/sync/trakt");
  revalidatePath("/settings/sync/tmdb");
  revalidatePath("/movies");
  revalidatePath("/search");
}

function settingsActionErrorPath(path: string, action: string, error: unknown) {
  if (!isAppError(error)) {
    throw error;
  }

  logSettingsActionError(error);

  const params = new URLSearchParams({
    error: `Could not ${action}`,
    errorAction: action,
  });

  return `${path}?${params}`;
}

function logSettingsActionError(error: { cause?: unknown; code: string; message: string; status: number }) {
  if (error.status < 500) {
    return;
  }

  console.error("Provider settings action failed", {
    cause: error.cause,
    code: error.code,
    message: error.message,
    status: error.status,
  });
}
