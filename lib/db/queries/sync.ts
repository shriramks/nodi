import "server-only";

import { requireUser } from "@/lib/auth/server";
import { throwDatabaseError } from "@/lib/db/errors";
import type { Provider, SyncDirection, SyncRunStatus } from "@/lib/db/types";
import {
  activeSyncRunMaxAgeMs,
  toSyncRunProgress,
  type SyncRunProgress,
} from "@/lib/db/queries/sync-run-state";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type ProviderSyncProgress = SyncRunProgress;

export type ProviderLastSyncRun = {
  direction: SyncDirection;
  errorMessage: string | null;
  eventType: string;
  processedAt: string | null;
  status: SyncRunStatus;
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
  retryableFailureCount: number;
};

const syncSummaryEventTypes = ["trakt.push.summary", "trakt.pull.summary"];
const syncProgressEventTypes = ["trakt.push.progress", "trakt.pull.progress"];
const staleSyncMessage = "Sync run stopped reporting progress and was marked failed.";

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

  await markStaleSyncState(admin, user.id, provider);

  const [
    connectionResult,
    secretRefsResult,
    lastSuccessResult,
    legacyLastSuccessResult,
    pendingCountResult,
    errorCountResult,
    lastFailureResult,
    lastRunResult,
    legacyLastRunResult,
    activeProgressResult,
    retryableFailureCountResult,
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
      .from("sync_runs")
      .select("finished_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "success")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
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
      .from("sync_runs")
      .select("direction, status, error_message, finished_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .order("started_at", { ascending: false })
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
      .from("sync_runs")
      .select("id, direction, status, phase, label, current, total, updated_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "running")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_item_failures")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("retry_status", "pending"),
  ]);

  if (connectionResult.error) {
    throwDatabaseError("Failed to load provider connection.", connectionResult.error);
  }

  if (lastSuccessResult.error) {
    throwDatabaseError("Failed to load last sync success.", lastSuccessResult.error);
  }

  if (legacyLastSuccessResult.error) {
    throwDatabaseError("Failed to load legacy last sync success.", legacyLastSuccessResult.error);
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

  if (legacyLastRunResult.error) {
    throwDatabaseError("Failed to load legacy last sync run.", legacyLastRunResult.error);
  }

  if (activeProgressResult.error) {
    throwDatabaseError("Failed to load active sync progress.", activeProgressResult.error);
  }

  if (retryableFailureCountResult.error) {
    throwDatabaseError(
      "Failed to count retryable sync item failures.",
      retryableFailureCountResult.error,
    );
  }

  const activeProgress = activeProgressResult.data
    ? toSyncRunProgress({
        current: activeProgressResult.data.current,
        direction: activeProgressResult.data.direction,
        id: activeProgressResult.data.id,
        label: activeProgressResult.data.label,
        phase: activeProgressResult.data.phase,
        status: activeProgressResult.data.status,
        total: activeProgressResult.data.total,
        updatedAt: activeProgressResult.data.updated_at,
      })
    : null;

  const legacyLastRun = legacyLastRunResult.data?.status === "success" ||
    legacyLastRunResult.data?.status === "error"
    ? {
        direction: legacyLastRunResult.data.direction,
        errorMessage: legacyLastRunResult.data.error_message,
        eventType: legacyLastRunResult.data.event_type,
        processedAt: legacyLastRunResult.data.processed_at,
        status: legacyLastRunResult.data.status,
      }
    : null;
  const lastSuccessAt = latestTimestamp(
    lastSuccessResult.data?.finished_at ?? null,
    legacyLastSuccessResult.data?.processed_at ?? null,
  );

  return {
    activeProgress,
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
          eventType: `trakt.${lastRunResult.data.direction}.run`,
          processedAt: lastRunResult.data.finished_at,
          status: lastRunResult.data.status,
        }
      : legacyLastRun,
    lastSuccessAt,
    pendingCount: pendingCountResult.count ?? 0,
    retryableFailureCount: retryableFailureCountResult.count ?? 0,
  };
}

function latestTimestamp(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return Date.parse(left) > Date.parse(right) ? left : right;
}

async function markStaleSyncState(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  provider: Provider,
) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - activeSyncRunMaxAgeMs).toISOString();
  const timestamp = now.toISOString();
  const { error: runError } = await admin
    .from("sync_runs")
    .update({
      error_message: staleSyncMessage,
      finished_at: timestamp,
      label: "Sync timed out",
      phase: "error",
      status: "error",
    })
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "running")
    .lt("updated_at", cutoff);

  if (runError) {
    throwDatabaseError("Failed to mark stale sync runs.", runError);
  }

  const { error: eventError } = await admin
    .from("sync_events")
    .update({
      error_message: staleSyncMessage,
      processed_at: timestamp,
      status: "error",
    })
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("status", "pending")
    .in("event_type", syncProgressEventTypes)
    .lt("processed_at", cutoff);

  if (eventError) {
    throwDatabaseError("Failed to mark stale sync progress events.", eventError);
  }
}
