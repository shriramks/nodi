"use client";

import { CircleStop, DownloadCloud, RefreshCcw, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SettingsPanel } from "@/components/ui/settings";
import type { ProviderSyncSettings } from "@/lib/db/queries/sync";

type SyncAction = "pull" | "push";
type PullMode = "full" | "shows";

type TraktSyncControlsProps = {
  initialSync: ProviderSyncSettings;
};

export function TraktSyncControls({ initialSync }: TraktSyncControlsProps) {
  const router = useRouter();
  const [syncState, setSyncState] = useState(initialSync);
  const [runningAction, setRunningAction] = useState<SyncAction | null>(null);
  const [pullMode, setPullMode] = useState<PullMode>("full");
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = syncState.connection?.status === "active";
  const progress = syncState.activeProgress;
  const hasActiveProgress = Boolean(progress);
  const progressUpdatedAt = progress?.updatedAt ?? null;
  const progressPercent = progress?.percent ?? (runningAction ? 0 : null);
  const progressCount = progress ? formatProgressCount(progress) : "0/0";

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const next = await loadSyncStatus();

      if (!cancelled && next) {
        setSyncState(next);
      }
    }

    if (!runningAction && !hasActiveProgress) {
      return () => {
        cancelled = true;
      };
    }

    void poll();

    const interval = window.setInterval(() => {
      void poll();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [hasActiveProgress, progressUpdatedAt, runningAction]);

  async function refreshSyncStatus() {
    const next = await loadSyncStatus();

    if (next) {
      setSyncState(next);
    }
  }

  async function runSync(action: SyncAction) {
    setError(null);
    setRunningAction(action);

    try {
      const body = action === "pull" ? JSON.stringify({ mode: pullMode }) : undefined;
      const response = await fetch(`/api/sync/trakt/${action}`, {
        body,
        headers: body ? { "content-type": "application/json" } : undefined,
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Sync failed.");
      }

      await refreshSyncStatus();
      router.refresh();
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "Sync failed.";

      setError(message === "Sync was stopped by the user." ? null : message);
      await refreshSyncStatus();
    } finally {
      setRunningAction(null);
    }
  }

  async function stopSync() {
    setError(null);
    setStopping(true);

    try {
      const response = await fetch("/api/sync/trakt/stop", {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not stop sync.");
      }

      setRunningAction(null);
      await refreshSyncStatus();
      router.refresh();
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Could not stop sync.");
      await refreshSyncStatus();
    } finally {
      setStopping(false);
    }
  }

  return (
    <section className="space-y-4">
      <SettingsPanel className="space-y-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-foreground">
              {progress?.label ?? (runningAction ? "Starting sync" : "No active sync")}
            </p>
            <p className="mt-1 text-[13px] text-text-muted">
              {progress
                ? `${progress.direction} · ${progress.phase}`
                : "Push local changes or pull from Trakt"}
            </p>
          </div>
          {progressPercent !== null ? (
            <p className="tabnum text-[24px] font-bold text-foreground">{progressPercent}%</p>
          ) : null}
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPercent ?? 0}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[12px] text-text-muted">
          <span className="tabnum">{progressCount}</span>
          <span>{formatTimestamp(progress?.updatedAt ?? null)}</span>
        </div>
      </SettingsPanel>

      <dl className="grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-2xl border border-border bg-surface p-3">
          <dt className="text-text-muted">Last sync</dt>
          <dd className="mt-1 tabnum text-foreground">
            {formatTimestamp(syncState.lastSuccessAt)}
          </dd>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <dt className="text-text-muted">Last status</dt>
          <dd className={["mt-1", lastStatusClass(syncState)].join(" ")}>
            {syncState.lastRun ? syncState.lastRun.status : "Never"}
          </dd>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <dt className="text-text-muted">Pending</dt>
          <dd className="mt-1 tabnum text-foreground">{syncState.pendingCount}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <dt className="text-text-muted">Failures</dt>
          <dd className="mt-1 tabnum text-foreground">{syncState.errorCount}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <dt className="text-text-muted">Retry backlog</dt>
          <dd className="mt-1 tabnum text-foreground">{syncState.retryableFailureCount}</dd>
        </div>
      </dl>

      {syncState.lastFailure ? (
        <p className="rounded-2xl border border-border bg-surface p-3 text-[13px] leading-[1.4] text-unsynced">
          {syncState.lastFailure.errorMessage ?? syncState.lastFailure.eventType}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-border bg-surface p-3 text-[13px] leading-[1.4] text-unsynced">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {progress || runningAction ? (
          <button
            type="button"
            disabled={stopping}
            onClick={stopSync}
            className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-[15px] font-semibold text-unsynced disabled:cursor-not-allowed disabled:opacity-45"
          >
            {stopping ? (
              <RefreshCcw aria-hidden="true" className="h-5 w-5 animate-spin" />
            ) : (
              <CircleStop aria-hidden="true" className="h-5 w-5" />
            )}
            {stopping ? "Stopping" : "Stop sync"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!connected || stopping || runningAction !== null || Boolean(progress)}
          onClick={() => runSync("push")}
          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-surface px-3 text-[13px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          {runningAction === "push" || progress?.direction === "push" ? (
            <RefreshCcw aria-hidden="true" className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud aria-hidden="true" className="h-5 w-5" />
          )}
          Push to Trakt
        </button>
        <div className="flex min-h-16 flex-col gap-2 rounded-2xl border border-border bg-surface p-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-background p-1">
            <button
              type="button"
              disabled={stopping || runningAction !== null || Boolean(progress)}
              onClick={() => setPullMode("full")}
              className={pullModeButtonClass(pullMode === "full")}
            >
              Movies + TV
            </button>
            <button
              type="button"
              disabled={stopping || runningAction !== null || Boolean(progress)}
              onClick={() => setPullMode("shows")}
              className={pullModeButtonClass(pullMode === "shows")}
            >
              TV only
            </button>
          </div>
          <button
            type="button"
            disabled={!connected || stopping || runningAction !== null || Boolean(progress)}
            onClick={() => runSync("pull")}
            className="flex min-h-8 items-center justify-center gap-1 rounded-xl px-2 text-[13px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-45"
          >
            {runningAction === "pull" || progress?.direction === "pull" ? (
              <RefreshCcw aria-hidden="true" className="h-5 w-5 animate-spin" />
            ) : (
              <DownloadCloud aria-hidden="true" className="h-5 w-5" />
            )}
            {pullMode === "shows" ? "Pull TV only" : "Pull movies + TV"}
          </button>
        </div>
      </div>
    </section>
  );
}

function pullModeButtonClass(active: boolean) {
  return [
    "h-8 rounded-lg px-2 text-[12px] font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-45",
    active ? "bg-surface text-foreground shadow-sm" : "text-text-muted",
  ].join(" ");
}

async function loadSyncStatus() {
  try {
    const response = await fetch("/api/sync/trakt/status", {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ProviderSyncSettings;
  } catch {
    return null;
  }
}

function lastStatusClass(sync: ProviderSyncSettings) {
  if (sync.lastRun?.status === "error") {
    return "text-unsynced";
  }

  if (sync.lastRun?.status === "success") {
    return "text-watched";
  }

  return "text-foreground";
}

function formatProgressCount(progress: NonNullable<ProviderSyncSettings["activeProgress"]>) {
  if (progress.itemCurrent !== null) {
    const count = progress.itemTotal !== null
      ? `${progress.itemCurrent}/${progress.itemTotal}`
      : `${progress.itemCurrent}`;

    return progress.itemLabel ? `${count} ${progress.itemLabel}` : count;
  }

  return `${progress.current}/${progress.total}`;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
