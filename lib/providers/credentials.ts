import "server-only";

import { encryptProviderSecret, decryptProviderSecret } from "@/lib/crypto/provider-secrets";
import { throwDatabaseError } from "@/lib/db/errors";
import type {
  Provider,
  ProviderConnection,
  ProviderConnectionStatus,
} from "@/lib/db/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ProviderSecretColumn =
  | "access_token_encrypted"
  | "api_token_encrypted"
  | "client_id_encrypted"
  | "client_secret_encrypted"
  | "refresh_token_encrypted";

type ProviderSecretValues = Partial<Record<ProviderSecretColumn, string | null>>;
type ProviderSecretRefs = Record<ProviderSecretColumn, string | null>;

type ProviderConnectionPatch = {
  lastValidatedAt?: string | null;
  providerUserId?: string | null;
  scopes?: string[] | null;
  status?: ProviderConnectionStatus;
  tokenExpiresAt?: string | null;
};

const providerSecretColumns = [
  "access_token_encrypted",
  "api_token_encrypted",
  "client_id_encrypted",
  "client_secret_encrypted",
  "refresh_token_encrypted",
] as const satisfies readonly ProviderSecretColumn[];

export async function upsertProviderConnectionForUser(
  userId: string,
  provider: Provider,
  patch: ProviderConnectionPatch = {},
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("provider_connections")
    .upsert(
      {
        user_id: userId,
        provider,
        provider_user_id: patch.providerUserId ?? null,
        token_expires_at: patch.tokenExpiresAt ?? null,
        scopes: patch.scopes ?? null,
        status: patch.status ?? "revoked",
        last_validated_at: patch.lastValidatedAt ?? null,
      },
      { onConflict: "user_id,provider" },
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to upsert provider connection.", error);
  }

  return data;
}

export async function updateProviderEncryptedSecrets(
  userId: string,
  provider: Provider,
  connectionId: string,
  values: ProviderSecretValues,
) {
  const existingRefs = await loadProviderSecretRefs(userId, provider);
  const nextRefs = { ...existingRefs };

  for (const column of providerSecretColumns) {
    if (!Object.hasOwn(values, column)) {
      continue;
    }

    const value = values[column];
    nextRefs[column] = value ? encryptProviderSecret(value) : null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("provider_connection_secrets")
    .upsert(
      {
        connection_id: connectionId,
        user_id: userId,
        provider,
        ...nextRefs,
      },
      { onConflict: "connection_id" },
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to update provider encrypted secrets.", error);
  }

  return data;
}

export async function readProviderSecret(
  userId: string,
  provider: Provider,
  column: ProviderSecretColumn,
) {
  const refs = await loadProviderSecretRefs(userId, provider);
  const ciphertext = refs[column];

  return ciphertext ? decryptProviderSecret(ciphertext) : null;
}

export async function loadProviderSecretRefs(
  userId: string,
  provider: Provider,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("provider_connection_secrets")
    .select(
      "access_token_encrypted, api_token_encrypted, client_id_encrypted, client_secret_encrypted, refresh_token_encrypted",
    )
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to load provider secret references.", error);
  }

  return toProviderSecretRefs(data);
}

export async function getProviderConnectionForUser(
  userId: string,
  provider: Provider,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("provider_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throwDatabaseError("Failed to load provider connection.", error);
  }

  return data;
}

export async function updateProviderConnectionForUser(
  userId: string,
  provider: Provider,
  patch: ProviderConnectionPatch,
) {
  const updatePayload: Partial<ProviderConnection> = {};

  if (Object.hasOwn(patch, "providerUserId")) {
    updatePayload.provider_user_id = patch.providerUserId ?? null;
  }

  if (Object.hasOwn(patch, "tokenExpiresAt")) {
    updatePayload.token_expires_at = patch.tokenExpiresAt ?? null;
  }

  if (Object.hasOwn(patch, "scopes")) {
    updatePayload.scopes = patch.scopes ?? null;
  }

  if (Object.hasOwn(patch, "status")) {
    updatePayload.status = patch.status;
  }

  if (Object.hasOwn(patch, "lastValidatedAt")) {
    updatePayload.last_validated_at = patch.lastValidatedAt ?? null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("provider_connections")
    .update(updatePayload)
    .eq("user_id", userId)
    .eq("provider", provider)
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to update provider connection.", error);
  }

  return data;
}

function toProviderSecretRefs(secret: Partial<ProviderSecretRefs> | null) {
  return {
    access_token_encrypted: secret?.access_token_encrypted ?? null,
    api_token_encrypted: secret?.api_token_encrypted ?? null,
    client_id_encrypted: secret?.client_id_encrypted ?? null,
    client_secret_encrypted: secret?.client_secret_encrypted ?? null,
    refresh_token_encrypted: secret?.refresh_token_encrypted ?? null,
  } satisfies Record<ProviderSecretColumn, string | null>;
}
