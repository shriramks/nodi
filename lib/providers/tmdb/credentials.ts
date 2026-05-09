import "server-only";

import { requireUser } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import {
  getProviderConnectionForUser,
  updateProviderConnectionForUser,
  updateProviderEncryptedSecrets,
  upsertProviderConnectionForUser,
} from "@/lib/providers/credentials";

export async function saveCurrentUserTmdbApiToken(apiTokenValue: string) {
  const user = await requireUser();
  const apiToken = normalizeTmdbApiToken(apiTokenValue);
  const connection = await upsertProviderConnectionForUser(user.id, "tmdb", {
    status: "active",
    lastValidatedAt: new Date().toISOString(),
  });

  await updateProviderEncryptedSecrets(user.id, "tmdb", connection.id, {
    api_token_encrypted: apiToken,
  });

  return connection;
}

export async function disconnectCurrentUserTmdb() {
  const user = await requireUser();
  const connection = await getProviderConnectionForUser(user.id, "tmdb");

  if (!connection) {
    return;
  }

  await updateProviderEncryptedSecrets(user.id, "tmdb", connection.id, {
    api_token_encrypted: null,
  });
  await updateProviderConnectionForUser(user.id, "tmdb", {
    status: "revoked",
    lastValidatedAt: null,
  });
}

function normalizeTmdbApiToken(value: string) {
  const normalized = value.trim();

  if (normalized.length < 20) {
    throw new AppError("TMDB API Read Access Token is too short.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  if (normalized.length > 2000) {
    throw new AppError("TMDB API Read Access Token is too long.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return normalized;
}
