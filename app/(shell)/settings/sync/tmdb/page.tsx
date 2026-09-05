import type { Metadata } from "next";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsErrorModal } from "@/components/settings/settings-error-modal";
import { TmdbBackfillControls } from "@/components/settings/tmdb-backfill-controls";
import { PageHeader } from "@/components/ui/section";
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
    <main className="space-y-0">
      <PageHeader
        leading={<BackButton />}
        title="TMDB"
        subtitle="Required for search, posters, cast, and media metadata."
      >
        {connected ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-watched/12 px-2.5 py-1 text-[12px] font-semibold text-watched">
            <span className="h-1.5 w-1.5 rounded-full bg-watched" />
            Active
          </span>
        ) : (
          <span className="mt-2 inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-text-muted">
            Token required
          </span>
        )}
      </PageHeader>

      {params.error ? (
        <SettingsErrorModal
          action={params.errorAction ?? "update TMDB settings"}
          logKey={params.errorLogKey}
        />
      ) : null}

      <section className="pt-8">
        <p className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
          API Token
        </p>
        <form action={saveTmdbTokenAction}>
          <div className="h-px bg-divider -mx-4" />
          <div className="flex items-center gap-3 py-3">
            <input
              name="apiToken"
              autoComplete="off"
              placeholder={sync.credentials.hasApiToken ? "Saved — enter to replace" : "Paste token"}
              required
              type="password"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-text-faint"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-accent/12 px-3 py-1.5 text-[13px] font-semibold text-accent"
            >
              Save
            </button>
          </div>
          <div className="h-px bg-divider -mx-4" />
        </form>
      </section>

      <TmdbBackfillControls enabled={connected} />

      {connected ? (
        <section className="pt-8">
          <div className="h-px bg-divider -mx-4" />
          <form action={disconnectTmdbAction}>
            <button
              type="submit"
              className="flex w-full items-center py-3 text-[15px] font-semibold text-unsynced"
            >
              Remove TMDB Token
            </button>
          </form>
          <div className="h-px bg-divider -mx-4" />
        </section>
      ) : null}
    </main>
  );
}
