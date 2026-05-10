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
        const response = await fetch("/api/movies/tmdb/backfill?limit=50", { method: "POST" });
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

  const status = running
    ? `Enriched ${enrichedTotal}${remaining !== null ? ` · ${remaining} remaining` : ""}`
    : done
      ? `Done — ${enrichedTotal} enriched${failedTotal > 0 ? ` · ${failedTotal} failed` : ""}`
      : enabled
        ? "Ready"
        : "Token required";

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold text-foreground">Metadata backfill</p>
          <p className="mt-1 text-[13px] text-text-2">{status}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!enabled || running}
          onClick={runBackfill}
          type="button"
        >
          <RefreshCcw
            aria-hidden="true"
            className={["h-5 w-5", running ? "animate-spin" : ""].join(" ")}
          />
          {running ? "Backfilling…" : "Backfill Metadata"}
        </button>

        {running ? (
          <button
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted text-text-2"
            onClick={stopBackfill}
            type="button"
            aria-label="Stop backfill"
          >
            <Square aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {error ? <p className="text-[13px] leading-[1.4] text-unsynced">{error}</p> : null}

      {failureSample && !error ? (
        <p className="text-[13px] leading-[1.4] text-unsynced">{failureSample}</p>
      ) : null}
    </section>
  );
}
