import "server-only";

import { requireUser } from "@/lib/auth/server";
import type { ProviderConnection } from "@/lib/db/types";
import { AppError } from "@/lib/errors";
import {
  getProviderConnectionForUser,
  readProviderSecret,
  updateProviderConnectionForUser,
  updateProviderEncryptedSecrets,
  upsertProviderConnectionForUser,
} from "@/lib/providers/credentials";
import {
  refreshTraktToken,
  type TraktAuth,
  type TraktOAuthTokenResponse,
} from "@/lib/providers/trakt/client";

export type TraktAppCredentials = {
  clientId: string;
  clientSecret: string;
  connection: ProviderConnection;
};

export type TraktSyncCredentials = TraktAuth & {
  clientSecret: string;
  connection: ProviderConnection;
  refreshToken: string;
};

const tokenRefreshBufferMs = 5 * 60 * 1000;

export async function saveCurrentUserTraktAppCredentials(payload: {
  clientId: string;
  clientSecret: string;
}) {
  const user = await requireUser();
  return saveTraktAppCredentials(user.id, payload);
}

export async function saveTraktAppCredentials(
  userId: string,
  payload: {
    clientId: string;
    clientSecret: string;
  },
) {
  const clientId = normalizeCredential(payload.clientId, "Trakt client ID");
  const clientSecret = normalizeCredential(payload.clientSecret, "Trakt client secret");
  const existingConnection = await getProviderConnectionForUser(userId, "trakt");
  const connection = await upsertProviderConnectionForUser(userId, "trakt", {
    providerUserId: null,
    status: existingConnection?.status === "active" ? "revoked" : "revoked",
    tokenExpiresAt: null,
    lastValidatedAt: null,
  });

  await updateProviderEncryptedSecrets(userId, "trakt", connection.id, {
    client_id_encrypted: clientId,
    client_secret_encrypted: clientSecret,
    access_token_encrypted: null,
    refresh_token_encrypted: null,
  });

  return connection;
}

export async function loadCurrentUserTraktAppCredentials() {
  const user = await requireUser();
  return loadTraktAppCredentials(user.id);
}

export async function loadTraktAppCredentials(userId: string): Promise<TraktAppCredentials> {
  const connection = await getProviderConnectionForUser(userId, "trakt");

  if (!connection) {
    throw new AppError("Save Trakt app credentials before connecting.", {
      code: "TRAKT_APP_CREDENTIALS_MISSING",
      status: 409,
    });
  }

  const [clientId, clientSecret] = await Promise.all([
    readProviderSecret(userId, "trakt", "client_id_encrypted"),
    readProviderSecret(userId, "trakt", "client_secret_encrypted"),
  ]);

  if (!clientId || !clientSecret) {
    throw new AppError("Save Trakt app credentials before connecting.", {
      code: "TRAKT_APP_CREDENTIALS_MISSING",
      status: 409,
    });
  }

  return {
    clientId,
    clientSecret,
    connection,
  };
}

export async function saveTraktOAuthTokens(
  userId: string,
  tokens: TraktOAuthTokenResponse,
  options: {
    providerUserId?: string | null;
  } = {},
) {
  const connection = await getProviderConnectionForUser(userId, "trakt");

  if (!connection) {
    throw new AppError("Save Trakt app credentials before connecting.", {
      code: "TRAKT_APP_CREDENTIALS_MISSING",
      status: 409,
    });
  }

  await updateProviderEncryptedSecrets(userId, "trakt", connection.id, {
    access_token_encrypted: tokens.access_token,
    refresh_token_encrypted: tokens.refresh_token,
  });

  return updateProviderConnectionForUser(userId, "trakt", {
    providerUserId: options.providerUserId ?? connection.provider_user_id,
    scopes: tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : null,
    status: "active",
    tokenExpiresAt: tokenExpiresAt(tokens),
    lastValidatedAt: new Date().toISOString(),
  });
}

export async function loadTraktSyncCredentials(
  userId: string,
  origin: string,
): Promise<TraktSyncCredentials> {
  const app = await loadTraktAppCredentials(userId);
  const [accessToken, refreshToken] = await Promise.all([
    readProviderSecret(userId, "trakt", "access_token_encrypted"),
    readProviderSecret(userId, "trakt", "refresh_token_encrypted"),
  ]);

  if (!accessToken || !refreshToken || app.connection.status !== "active") {
    throw new AppError("Connect Trakt before syncing.", {
      code: "TRAKT_NOT_CONNECTED",
      status: 409,
    });
  }

  if (!shouldRefreshToken(app.connection.token_expires_at)) {
    return {
      accessToken,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      connection: app.connection,
      refreshToken,
    };
  }

  const refreshedTokens = await refreshTraktToken({
    clientId: app.clientId,
    clientSecret: app.clientSecret,
    refreshToken,
    redirectUri: getTraktRedirectUri(origin),
  });
  const refreshedConnection = await saveTraktOAuthTokens(userId, refreshedTokens);

  return {
    accessToken: refreshedTokens.access_token,
    clientId: app.clientId,
    clientSecret: app.clientSecret,
    connection: refreshedConnection,
    refreshToken: refreshedTokens.refresh_token,
  };
}

export async function disconnectCurrentUserTrakt() {
  const user = await requireUser();
  const connection = await getProviderConnectionForUser(user.id, "trakt");

  if (!connection) {
    return;
  }

  await updateProviderEncryptedSecrets(user.id, "trakt", connection.id, {
    access_token_encrypted: null,
    refresh_token_encrypted: null,
  });
  await updateProviderConnectionForUser(user.id, "trakt", {
    providerUserId: null,
    status: "revoked",
    tokenExpiresAt: null,
    lastValidatedAt: null,
  });
}

export function getTraktRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/providers/trakt/callback`;
}

function normalizeCredential(value: string, label: string) {
  const normalized = value.trim();

  if (normalized.length < 8) {
    throw new AppError(`${label} is too short.`, {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  if (normalized.length > 500) {
    throw new AppError(`${label} is too long.`, {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return normalized;
}

function shouldRefreshToken(tokenExpiresAt: string | null) {
  if (!tokenExpiresAt) {
    return true;
  }

  return Date.parse(tokenExpiresAt) - Date.now() <= tokenRefreshBufferMs;
}

function tokenExpiresAt(tokens: TraktOAuthTokenResponse) {
  const createdAtMs = tokens.created_at ? tokens.created_at * 1000 : Date.now();
  return new Date(createdAtMs + tokens.expires_in * 1000).toISOString();
}
