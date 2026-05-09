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
    targetPath = settingsActionErrorPath(traktSettingsPath, error);
  }

  redirect(targetPath);
}

export async function disconnectTraktAction() {
  let targetPath = traktSettingsPath;

  try {
    await disconnectCurrentUserTrakt();
    revalidateSettings();
  } catch (error) {
    targetPath = settingsActionErrorPath(traktSettingsPath, error);
  }

  redirect(targetPath);
}

export async function saveTmdbTokenAction(formData: FormData) {
  let targetPath = tmdbSettingsPath;

  try {
    await saveCurrentUserTmdbApiToken(String(formData.get("apiToken") ?? ""));
    revalidateSettings();
  } catch (error) {
    targetPath = settingsActionErrorPath(tmdbSettingsPath, error);
  }

  redirect(targetPath);
}

export async function disconnectTmdbAction() {
  let targetPath = tmdbSettingsPath;

  try {
    await disconnectCurrentUserTmdb();
    revalidateSettings();
  } catch (error) {
    targetPath = settingsActionErrorPath(tmdbSettingsPath, error);
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

function settingsActionErrorPath(path: string, error: unknown) {
  if (!isAppError(error)) {
    throw error;
  }

  logSettingsActionError(error);

  return `${path}?error=${encodeURIComponent(settingsActionErrorMessage(error))}`;
}

function settingsActionErrorMessage(error: { code: string; message: string; status: number }) {
  switch (error.code) {
    case "PROVIDER_SECRETS_KEY_MISSING":
      return "PROVIDER_SECRETS_KEY is not configured on the server.";
    case "PROVIDER_SECRETS_KEY_INVALID":
      return "PROVIDER_SECRETS_KEY must be a 32-byte base64url value.";
    default:
      return error.status >= 500
        ? `${error.message} Check the server configuration and logs.`
        : error.message;
  }
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
