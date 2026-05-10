"use client";

import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TmdbBackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runBackfill() {
    setError(null);
    setRunning(true);

    try {
      const response = await fetch("/api/movies/tmdb/backfill?limit=20", {
        method: "POST",
      });
      const payload = (await response.json()) as TmdbBackfillResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Metadata backfill failed.");
      }

      setResult(payload);
      router.refresh();
    } catch (backfillError) {
      setError(
        backfillError instanceof Error
          ? backfillError.message
          : "Metadata backfill failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  const status = result
    ? `${result.enriched} enriched · ${result.failed} failed`
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
        {result?.remaining ? (
          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-text-2">
            +{result.remaining}
          </span>
        ) : null}
      </div>

      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!enabled || running}
        onClick={runBackfill}
        type="button"
      >
        <RefreshCcw
          aria-hidden="true"
          className={["h-5 w-5", running ? "animate-spin" : ""].join(" ")}
        />
        {running ? "Backfilling" : "Backfill Metadata"}
      </button>

      {error ? (
        <p className="text-[13px] leading-[1.4] text-unsynced">{error}</p>
      ) : null}

      {result?.failureSamples.length ? (
        <p className="text-[13px] leading-[1.4] text-unsynced">
          {result.failureSamples[0]}
        </p>
      ) : null}
    </section>
  );
}
