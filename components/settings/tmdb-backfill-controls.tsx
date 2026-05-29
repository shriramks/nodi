"use client";

import { RefreshCcw, Square } from "lucide-react";
import { useRef, useState } from "react";

type TmdbBackfillResult = {
  enriched: number;
  failed: number;
  failureSamples: string[];
  processed: number;
  remaining: number;
  skipped: number;
};

type TmdbBackfillControlsProps = {
  enabled: boolean;
};

export function TmdbBackfillControls({ enabled }: TmdbBackfillControlsProps) {
  const [running, setRunning] = useState(false);
  const [enrichedTotal, setEnrichedTotal] = useState(0);
  const [failedTotal, setFailedTotal] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [failureSample, setFailureSample] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);

  async function runBackfill() {
    setError(null);
    setDone(false);
    setEnrichedTotal(0);
    setFailedTotal(0);
    setRemaining(null);
    setFailureSample(null);
    setRunning(true);
    stopRef.current = false;

    let cumulativeEnriched = 0;
    let cumulativeFailed = 0;
    let lastFailureSample: string | null = null;

    try {
      while (!stopRef.current) {
        const response = await fetch("/api/movies/tmdb/backfill?budget=100", { method: "POST" });
        const payload = (await response.json()) as TmdbBackfillResult & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Metadata backfill failed.");
        }

        cumulativeEnriched += payload.enriched;
        cumulativeFailed += payload.failed;
        if (payload.failureSamples.length > 0) {
          lastFailureSample = payload.failureSamples[0];
        }

        setEnrichedTotal(cumulativeEnriched);
        setFailedTotal(cumulativeFailed);
        setRemaining(payload.remaining);
        setFailureSample(lastFailureSample);

        if (payload.remaining === 0) {
          break;
        }
      }

      setDone(!stopRef.current);
    } catch (backfillError) {
      setError(
        backfillError instanceof Error ? backfillError.message : "Metadata backfill failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  function stopBackfill() {
    stopRef.current = true;
  }

  const statusText = running
    ? `Enriched ${enrichedTotal}${remaining !== null ? ` · ${remaining} remaining` : ""}`
    : done
      ? `Done — ${enrichedTotal} enriched${failedTotal > 0 ? ` · ${failedTotal} failed` : ""}`
      : enabled
        ? "Ready"
        : "Token required";

  return (
    <section className="pt-8">
      <p className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
        Metadata Backfill
      </p>
      <div className="h-px bg-divider -mx-4" />
      <div className="flex items-center gap-3 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground">Backfill Metadata</p>
          <p className="mt-0.5 text-[13px] text-text-muted">{statusText}</p>
        </div>
        {running ? (
          <button
            type="button"
            onClick={stopBackfill}
            aria-label="Stop backfill"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-text-2"
          >
            <Square aria-hidden className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!enabled}
            onClick={runBackfill}
            className="shrink-0 rounded-lg bg-accent/12 px-3 py-1.5 text-[13px] font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCcw aria-hidden className={["h-4 w-4", running ? "animate-spin" : ""].join(" ")} />
          </button>
        )}
      </div>
      <div className="h-px bg-divider -mx-4" />

      {error ? (
        <p className="pt-2 text-[13px] leading-[1.4] text-unsynced">{error}</p>
      ) : null}
      {failureSample && !error ? (
        <p className="pt-2 text-[13px] leading-[1.4] text-unsynced">{failureSample}</p>
      ) : null}
    </section>
  );
}
