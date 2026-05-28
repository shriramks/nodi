import "server-only";

import { requireUser } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import { throwDatabaseError } from "@/lib/db/errors";
import type {
  Provider,
  ProviderConnection,
  ProviderConnectionSecret,
  SyncCursor,
  SyncEvent,
  SyncEventStatus,
} from "@/lib/db/types";
import {
  validateProviderConnectionPayload,
  validateProviderConnectionSecretPayload,
  validateSyncEventPayload,
  validateUuid,
} from "@/lib/db/validation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function upsertProviderConnection(
  payload: unknown,
): Promise<ProviderConnection> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const connection = validateProviderConnectionPayload(payload);

  const { data, error } = await supabase
    .from("provider_connections")
    .upsert(
      {
        user_id: user.id,
        provider: connection.provider,
        provider_user_id: connection.providerUserId ?? null,
        token_expires_at: connection.tokenExpiresAt ?? null,
        scopes: connection.scopes ?? null,
        status: connection.status ?? "active",
        last_validated_at: connection.lastValidatedAt ?? null,
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

export async function upsertProviderConnectionSecrets(
  payload: unknown,
): Promise<ProviderConnectionSecret> {
  const user = await requireUser();
  const supabase = createSupabaseAdminClient();
  const secrets = validateProviderConnectionSecretPayload(payload);

  const { data, error } = await supabase
    .from("provider_connection_secrets")
    .upsert(
      {
        connection_id: secrets.connectionId,
        user_id: user.id,
        provider: secrets.provider,
        access_token_secret_id: secrets.accessTokenSecretId ?? null,
        refresh_token_secret_id: secrets.refreshTokenSecretId ?? null,
      },
      { onConflict: "connection_id" },
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to upsert provider connection secrets.", error);
  }

  return data;
}

export async function upsertSyncCursor(
  provider: Provider,
  cursorKey: string,
  cursorValue: string | null,
): Promise<SyncCursor> {
  const user = await requireUser();
  const supabase = createSupabaseAdminClient();
  const normalizedCursorKey = cursorKey.trim();

  if (!normalizedCursorKey) {
    throw new AppError("cursorKey cannot be empty.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("sync_cursors")
    .upsert(
      {
        user_id: user.id,
        provider,
        cursor_key: normalizedCursorKey,
        cursor_value: cursorValue,
      },
      { onConflict: "user_id,provider,cursor_key" },
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to upsert sync cursor.", error);
  }

  return data;
}

export async function createSyncEvent(payload: unknown): Promise<SyncEvent> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const syncEvent = validateSyncEventPayload(payload);

  const { data, error } = await supabase
    .from("sync_events")
    .insert({
      user_id: user.id,
      provider: syncEvent.provider,
      direction: syncEvent.direction,
      event_type: syncEvent.eventType,
      status: syncEvent.status,
      payload: syncEvent.payload ?? {},
      error_message: syncEvent.errorMessage ?? null,
      processed_at: syncEvent.processedAt ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to create sync event.", error);
  }

  return data;
}

export async function queueTraktPushEvent(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await createSyncEvent({
    provider: "trakt",
    direction: "push",
    eventType,
    status: "pending",
    payload,
  });
}

export async function updateSyncEventStatus(
  eventId: string,
  payload: {
    errorMessage?: string | null;
    payload?: SyncEvent["payload"];
    processedAt?: string | null;
    status: SyncEventStatus;
  },
): Promise<SyncEvent> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = validateUuid(eventId, "eventId");
  const updatePayload: {
    error_message: string | null;
    payload?: SyncEvent["payload"];
    processed_at: string;
    status: SyncEventStatus;
  } = {
    error_message: payload.errorMessage ?? null,
    processed_at: payload.processedAt ?? new Date().toISOString(),
    status: payload.status,
  };

  if (payload.payload !== undefined) {
    updatePayload.payload = payload.payload;
  }

  const { data, error } = await supabase
    .from("sync_events")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throwDatabaseError("Failed to update sync event.", error);
  }

  return data;
}
