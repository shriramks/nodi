import type { Metadata } from "next";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsErrorModal } from "@/components/settings/settings-error-modal";
import { TmdbBackfillControls } from "@/components/settings/tmdb-backfill-controls";
import { PageHeader } from "@/components/ui/section";
import {
  SettingsActionButton,
  SettingsFieldLabel,
  SettingsPanel,
  SettingsStatusBadge,
  SettingsTextInput,
} from "@/components/ui/settings";
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
      <PageHeader
        leading={<BackButton />}
        title="TMDB"
        subtitle="Required for search, posters, cast, and media metadata."
      />

      {params.error ? (
        <SettingsErrorModal
          action={params.errorAction ?? "update TMDB settings"}
          logKey={params.errorLogKey}
        />
      ) : null}

      <SettingsPanel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-semibold text-foreground">API token</p>
            <p className="mt-1 text-[13px] text-text-2">
              {connected ? "Token saved" : "Token required"}
            </p>
          </div>
          <SettingsStatusBadge tone={connected ? "active" : "neutral"}>
            {connected ? "Active" : "Off"}
          </SettingsStatusBadge>
        </div>

        <form action={saveTmdbTokenAction} className="space-y-3">
          <label className="block">
            <SettingsFieldLabel>API Read Access Token</SettingsFieldLabel>
            <SettingsTextInput
              name="apiToken"
              autoComplete="off"
              placeholder={sync.credentials.hasApiToken ? "Saved. Enter to replace." : ""}
              required
              type="password"
            />
          </label>
          <SettingsActionButton type="submit">
            Save TMDB Token
          </SettingsActionButton>
        </form>

        {connected ? (
          <form action={disconnectTmdbAction}>
            <SettingsActionButton type="submit" tone="danger">
              Remove TMDB Token
            </SettingsActionButton>
          </form>
        ) : null}
      </SettingsPanel>

      <TmdbBackfillControls enabled={connected} />
    </main>
  );
}
