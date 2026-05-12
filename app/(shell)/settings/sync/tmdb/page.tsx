import type { Metadata } from "next";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsErrorModal } from "@/components/settings/settings-error-modal";
import { TmdbBackfillControls } from "@/components/settings/tmdb-backfill-controls";
import { getProviderSyncSettings } from "@/lib/db/queries";
import { disconnectTmdbAction, saveTmdbTokenAction } from "../actions";

export const metadata: Metadata = {
  title: "TMDB Settings",
};

type TmdbSettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    errorAction?: string;
    errorLogKey?: string;
  }>;
};

export default async function TmdbSettingsPage({ searchParams }: TmdbSettingsPageProps) {
  const [sync, params] = await Promise.all([
    getProviderSyncSettings("tmdb"),
    searchParams,
  ]);
  const connected = sync.connection?.status === "active" && sync.credentials.hasApiToken;

  return (
    <main className="space-y-6">
      <section>
        <BackButton />
        <h1 className="mt-2 text-[32px] font-bold leading-[1.1]">TMDB</h1>
        <p className="mt-1 text-[13px] text-text-2">
          Store your TMDB API Read Access Token for search and movie metadata.
        </p>
      </section>

      {params.error ? (
        <SettingsErrorModal
          action={params.errorAction ?? "update TMDB settings"}
          logKey={params.errorLogKey}
        />
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-semibold text-foreground">API token</p>
            <p className="mt-1 text-[13px] text-text-2">
              {connected ? "Token saved" : "Token required"}
            </p>
          </div>
          <span
            className={[
              "rounded-full px-2.5 py-1 text-[12px] font-semibold",
              connected ? "bg-watched/15 text-watched" : "bg-surface-muted text-text-2",
            ].join(" ")}
          >
            {connected ? "Active" : "Off"}
          </span>
        </div>

        <form action={saveTmdbTokenAction} className="space-y-3">
          <label className="block">
            <span className="text-[13px] text-text-muted">API Read Access Token</span>
            <input
              name="apiToken"
              autoComplete="off"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[15px] outline-none focus:border-accent"
              placeholder={sync.credentials.hasApiToken ? "Saved. Enter to replace." : ""}
              required
              type="password"
            />
          </label>
          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent"
          >
            Save TMDB Token
          </button>
        </form>

        {connected ? (
          <form action={disconnectTmdbAction}>
            <button
              type="submit"
              className="h-11 w-full rounded-xl border border-border bg-surface-muted px-4 text-[15px] font-semibold text-unsynced"
            >
              Remove TMDB Token
            </button>
          </form>
        ) : null}
      </section>

      <TmdbBackfillControls enabled={connected} />
    </main>
  );
}
