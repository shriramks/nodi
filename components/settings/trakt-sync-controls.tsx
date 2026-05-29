"use client";

import { CircleStop, DownloadCloud, RefreshCcw, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ProviderSyncSettings } from "@/lib/db/queries/sync";

type SyncAction = "pull" | "push";

type TraktSyncControlsProps = {
  initialSync: ProviderSyncSettings;
};

export function TraktSyncControls({ initialSync }: TraktSyncControlsProps) {
  const router = useRouter();
  const [syncState, setSyncState] = useState(initialSync);
  const [runningAction, setRunningAction] = useState<SyncAction | null>(null);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = syncState.connection?.status === "active";
  const progress = syncState.activeProgress;
  const hasActiveProgress = Boolean(progress);
  const progressUpdatedAt = progress?.updatedAt ?? null;
  const progressPercent = progress?.percent ?? (runningAction ? 0 : null);
  const progressCount = progress ? formatProgressCount(progress) : "0 / 0";

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const next = await loadSyncStatus();
      if (!cancelled && next) setSyncState(next);
    }

    if (!runningAction && !hasActiveProgress) {
      return () => { cancelled = true; };
    }

    void poll();
    const interval = window.setInterval(() => { void poll(); }, 1000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [hasActiveProgress, progressUpdatedAt, runningAction]);

  async function refreshSyncStatus() {
    const next = await loadSyncStatus();
    if (next) setSyncState(next);
  }

  async function runSync(action: SyncAction) {
    setError(null);
    setRunningAction(action);

    try {
      const response = await fetch(`/api/sync/trakt/${action}`, {
        body: action === "pull" ? JSON.stringify({ mode: "full" }) : undefined,
        headers: action === "pull" ? { "content-type": "application/json" } : undefined,
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(payload.error ?? "Sync failed.");

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
      const response = await fetch("/api/sync/trakt/stop", { method: "POST" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(payload.error ?? "Could not stop sync.");

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

  const isActive = progress || runningAction;

  return (
    <section className="pt-8">
      <p className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
        Sync
      </p>

      {/* Progress row */}
      <div className="h-px bg-divider -mx-4" />
      <div className="py-3">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-foreground">
            {progress?.label ?? (runningAction ? "Starting sync" : "No active sync")}
          </span>
          {progressPercent !== null ? (
            <span className="tabnum text-[15px] font-semibold text-foreground">
              {progressPercent}%
            </span>
          ) : null}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPercent ?? 0}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[12px] text-text-faint">
          <span className="tabnum">{progressCount}</span>
          <span>
            {progress
              ? `${progress.direction} · ${progress.phase}`
              : formatTimestamp(syncState.lastSuccessAt)}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="h-px bg-divider -mx-4" />
      <div className="grid grid-cols-2 divide-x divide-y divide-divider border-b border-divider -mx-4">
        <StatCell label="Last sync" value={formatTimestamp(syncState.lastSuccessAt)} />
        <StatCell
          label="Last status"
          value={syncState.lastRun ? syncState.lastRun.status : "Never"}
          tone={lastStatusTone(syncState)}
        />
        <StatCell label="Pending" value={String(syncState.pendingCount)} />
        <StatCell label="Failures" value={String(syncState.errorCount)} />
      </div>

      {/* Error */}
      {syncState.lastFailure && syncState.lastRun?.status !== "success" ? (
        <p className="pt-2 text-[13px] leading-[1.4] text-unsynced">
          {syncState.lastFailure.errorMessage ?? syncState.lastFailure.eventType}
        </p>
      ) : null}
      {error ? (
        <p className="pt-2 text-[13px] leading-[1.4] text-unsynced">{error}</p>
      ) : null}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {isActive ? (
          <button
            type="button"
            disabled={stopping}
            onClick={stopSync}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface-muted text-[14px] font-semibold text-unsynced disabled:cursor-not-allowed disabled:opacity-45"
          >
            {stopping ? (
              <RefreshCcw aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <CircleStop aria-hidden className="h-4 w-4" />
            )}
            {stopping ? "Stopping" : "Stop"}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!connected || Boolean(progress)}
              onClick={() => runSync("push")}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface-muted text-[14px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              {runningAction === "push" ? (
                <RefreshCcw aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud aria-hidden className="h-4 w-4" />
              )}
              Push
            </button>
            <button
              type="button"
              disabled={!connected || Boolean(progress)}
              onClick={() => runSync("pull")}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface-muted text-[14px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              {runningAction === "pull" ? (
                <RefreshCcw aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <DownloadCloud aria-hidden className="h-4 w-4" />
              )}
              Pull
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function StatCell({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "success" | "error" | "neutral";
  value: string;
}) {
  const valueClass = tone === "success"
    ? "text-watched"
    : tone === "error"
      ? "text-unsynced"
      : "text-foreground";

  return (
    <div className="px-4 py-3">
      <p className="text-[11px] text-text-faint">{label}</p>
      <p className={["mt-0.5 tabnum text-[15px] font-semibold capitalize", valueClass].join(" ")}>
        {value}
      </p>
    </div>
  );
}

async function loadSyncStatus() {
  try {
    const response = await fetch("/api/sync/trakt/status", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as ProviderSyncSettings;
  } catch {
    return null;
  }
}

function lastStatusTone(sync: ProviderSyncSettings): "success" | "error" | "neutral" {
  if (sync.lastRun?.status === "error") return "error";
  if (sync.lastRun?.status === "success") return "success";
  return "neutral";
}

function formatProgressCount(progress: NonNullable<ProviderSyncSettings["activeProgress"]>) {
  if (progress.itemCurrent !== null) {
    const count = progress.itemTotal !== null
      ? `${progress.itemCurrent} / ${progress.itemTotal}`
      : `${progress.itemCurrent}`;
    return progress.itemLabel ? `${count} ${progress.itemLabel}` : count;
  }
  return `${progress.current} / ${progress.total}`;
}

function formatTimestamp(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
