import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import type { Json, Provider, SyncDirection, SyncEventStatus } from "@/lib/db/types";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type ProviderSyncProgress = {
  current: number;
  direction: SyncDirection;
  label: string;
  percent: number;
  phase: string;
  total: number;
  updatedAt: string | null;
};

export type ProviderLastSyncRun = {
  direction: SyncDirection;
  errorMessage: string | null;
  eventType: string;
  processedAt: string | null;
  status: SyncEventStatus;
};

export type ProviderSyncSettings = {
  activeProgress: ProviderSyncProgress | null;
  connection: {
    providerUserId: string | null;
    status: string;
    tokenExpiresAt: string | null;
    lastValidatedAt: string | null;
  } | null;
  credentials: {
    hasAccessToken: boolean;
    hasApiToken: boolean;
    hasClientId: boolean;
    hasClientSecret: boolean;
    hasRefreshToken: boolean;
  };
  errorCount: number;
  lastFailure: {
    errorMessage: string | null;
    eventType: string;
    processedAt: string | null;
  } | null;
  lastRun: ProviderLastSyncRun | null;
  lastSuccessAt: string | null;
  pendingCount: number;
};

const syncSummaryEventTypes = ["trakt.push.summary", "trakt.pull.summary"];
const syncProgressEventTypes = ["trakt.push.progress", "trakt.pull.progress"];
const activeProgressMaxAgeMs = 2 * 60 * 1000;

export async function listProviderConnections() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("provider_connections")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throwDatabaseError("Failed to load provider connections.", error);
  }

  return data ?? [];
}

export async function listSyncCursors(provider?: Provider) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("sync_cursors")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (provider) {
    query = query.eq("provider", provider);
  }

  const { data, error } = await query;

  if (error) {
    throwDatabaseError("Failed to load sync cursors.", error);
  }

  return data ?? [];
}

export async function listSyncEvents(limit = 25) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const cappedLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("sync_events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(cappedLimit);

  if (error) {
    throwDatabaseError("Failed to load sync events.", error);
  }

  return data ?? [];
}

export async function listPendingSyncEvents(
  provider: Provider,
  direction: SyncDirection,
  limit = 50,
) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const cappedLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("sync_events")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .eq("direction", direction)
    .eq("status", "pending")
    .not("event_type", "like", "trakt.%")
    .order("created_at", { ascending: true })
    .limit(cappedLimit);

  if (error) {
    throwDatabaseError("Failed to load pending sync events.", error);
  }

  return data ?? [];
}

export async function getProviderSyncSettings(
  provider: Provider,
): Promise<ProviderSyncSettings> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [
    connectionResult,
    secretRefsResult,
    lastSuccessResult,
    pendingCountResult,
    errorCountResult,
    lastFailureResult,
    lastRunResult,
    activeProgressResult,
  ] = await Promise.all([
    supabase
      .from("provider_connections")
      .select("provider_user_id, token_expires_at, status, last_validated_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle(),
    admin
      .from("provider_connection_secrets")
      .select(
        "access_token_encrypted, api_token_encrypted, client_id_encrypted, client_secret_encrypted, refresh_token_encrypted",
      )
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle(),
    supabase
      .from("sync_events")
      .select("processed_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "success")
      .in("event_type", syncSummaryEventTypes)
      .not("processed_at", "is", null)
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "pending")
      .not("event_type", "like", "trakt.%"),
    supabase
      .from("sync_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "error"),
    supabase
      .from("sync_events")
      .select("event_type, error_message, processed_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "error")
      .order("processed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_events")
      .select("direction, event_type, status, error_message, processed_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .in("event_type", syncSummaryEventTypes)
      .order("processed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_events")
      .select("direction, event_type, payload, processed_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "pending")
      .in("event_type", syncProgressEventTypes)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (connectionResult.error) {
    throwDatabaseError("Failed to load provider connection.", connectionResult.error);
  }

  if (lastSuccessResult.error) {
    throwDatabaseError("Failed to load last sync success.", lastSuccessResult.error);
  }

  if (secretRefsResult.error) {
    throwDatabaseError("Failed to load provider credential state.", secretRefsResult.error);
  }

  if (pendingCountResult.error) {
    throwDatabaseError("Failed to count pending sync events.", pendingCountResult.error);
  }

  if (errorCountResult.error) {
    throwDatabaseError("Failed to count failed sync events.", errorCountResult.error);
  }

  if (lastFailureResult.error) {
    throwDatabaseError("Failed to load last sync failure.", lastFailureResult.error);
  }

  if (lastRunResult.error) {
    throwDatabaseError("Failed to load last sync run.", lastRunResult.error);
  }

  if (activeProgressResult.error) {
    throwDatabaseError("Failed to load active sync progress.", activeProgressResult.error);
  }

  const activeProgress = activeProgressResult.data
    ? toProviderSyncProgress(
        activeProgressResult.data.direction,
        activeProgressResult.data.payload,
        activeProgressResult.data.processed_at,
      )
    : null;

  return {
    activeProgress: isFreshProgress(activeProgress) ? activeProgress : null,
    connection: connectionResult.data
      ? {
          providerUserId: connectionResult.data.provider_user_id,
          status: connectionResult.data.status,
          tokenExpiresAt: connectionResult.data.token_expires_at,
          lastValidatedAt: connectionResult.data.last_validated_at,
        }
      : null,
    credentials: {
      hasAccessToken: Boolean(secretRefsResult.data?.access_token_encrypted),
      hasApiToken: Boolean(secretRefsResult.data?.api_token_encrypted),
      hasClientId: Boolean(secretRefsResult.data?.client_id_encrypted),
      hasClientSecret: Boolean(secretRefsResult.data?.client_secret_encrypted),
      hasRefreshToken: Boolean(secretRefsResult.data?.refresh_token_encrypted),
    },
    errorCount: errorCountResult.count ?? 0,
    lastFailure: lastFailureResult.data
      ? {
          errorMessage: lastFailureResult.data.error_message,
          eventType: lastFailureResult.data.event_type,
          processedAt: lastFailureResult.data.processed_at,
        }
      : null,
    lastRun: lastRunResult.data
      ? {
          direction: lastRunResult.data.direction,
          errorMessage: lastRunResult.data.error_message,
          eventType: lastRunResult.data.event_type,
          processedAt: lastRunResult.data.processed_at,
          status: lastRunResult.data.status,
        }
      : null,
    lastSuccessAt: lastSuccessResult.data?.processed_at ?? null,
    pendingCount: pendingCountResult.count ?? 0,
  };
}

function isFreshProgress(progress: ProviderSyncProgress | null) {
  if (!progress?.updatedAt) {
    return false;
  }

  return Date.now() - Date.parse(progress.updatedAt) <= activeProgressMaxAgeMs;
}

function toProviderSyncProgress(
  direction: SyncDirection,
  payload: Json,
  updatedAt: string | null,
): ProviderSyncProgress {
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
  const current = numberValue(record.current);
  const total = numberValue(record.total);

  return {
    current,
    direction,
    label: stringValue(record.label) ?? "Syncing",
    percent: clampPercent(record.percent, current, total),
    phase: stringValue(record.phase) ?? "sync",
    total,
    updatedAt,
  };
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(Math.floor(value), 0)
    : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clampPercent(value: unknown, current: number, total: number) {
  const percent = typeof value === "number" && Number.isFinite(value)
    ? value
    : total > 0
      ? (current / total) * 100
      : 0;

  return Math.min(Math.max(Math.round(percent), 0), 100);
}
