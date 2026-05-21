import type { Metadata } from "next";
import { headers } from "next/headers";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsErrorModal } from "@/components/settings/settings-error-modal";
import { TraktSyncControls } from "@/components/settings/trakt-sync-controls";
import { PageHeader } from "@/components/ui/section";
import {
  SettingsActionButton,
  SettingsFieldLabel,
  SettingsPanel,
  SettingsStatusBadge,
  SettingsTextInput,
} from "@/components/ui/settings";
import { getProviderSyncSettings } from "@/lib/db/queries";
import { getTraktRedirectUri } from "@/lib/providers/trakt/credentials";
import {
  disconnectTraktAction,
  saveTraktCredentialsAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Trakt Sync",
};

type TraktSyncPageProps = {
  searchParams: Promise<{
    connected?: string;
    error?: string;
    errorAction?: string;
    errorLogKey?: string;
  }>;
};

export default async function TraktSyncPage({ searchParams }: TraktSyncPageProps) {
  const [sync, params, headerStore] = await Promise.all([
    getProviderSyncSettings("trakt"),
    searchParams,
    headers(),
  ]);
  const origin = requestOrigin(headerStore);
  const redirectUri = getTraktRedirectUri(origin);
  const hasAppCredentials = sync.credentials.hasClientId && sync.credentials.hasClientSecret;
  const connected = sync.connection?.status === "active";

  return (
    <main className="space-y-6">
      <PageHeader
        leading={<BackButton />}
        title="Trakt Sync"
        subtitle="Optional syncing for watched history, ratings, and watchlist."
      />

      {params.connected ? (
        <p className="rounded-2xl border border-border bg-surface p-3 text-[13px] text-watched">
          Trakt connected.
        </p>
      ) : null}

      {params.error ? (
        <SettingsErrorModal
          action={params.errorAction ?? "update Trakt settings"}
          logKey={params.errorLogKey}
        />
      ) : null}

      <SettingsPanel>
        <div>
          <p className="text-[17px] font-semibold text-foreground">Trakt app credentials</p>
          <p className="mt-1 text-[13px] leading-[1.4] text-text-2">
            Create a Trakt API app and set its redirect URI to:
          </p>
          <p className="mt-2 break-all rounded-xl bg-background p-3 font-mono text-[12px] text-text-2">
            {redirectUri}
          </p>
        </div>

        <form action={saveTraktCredentialsAction} className="space-y-3">
          <label className="block">
            <SettingsFieldLabel>Client ID</SettingsFieldLabel>
            <SettingsTextInput
              name="clientId"
              autoComplete="off"
              placeholder={sync.credentials.hasClientId ? "Saved. Enter to replace." : ""}
              required
            />
          </label>
          <label className="block">
            <SettingsFieldLabel>Client Secret</SettingsFieldLabel>
            <SettingsTextInput
              name="clientSecret"
              autoComplete="off"
              placeholder={sync.credentials.hasClientSecret ? "Saved. Enter to replace." : ""}
              required
              type="password"
            />
          </label>
          <SettingsActionButton type="submit">
            Save Trakt App Credentials
          </SettingsActionButton>
        </form>
      </SettingsPanel>

      <SettingsPanel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-semibold text-foreground">Authorization</p>
            <p className="mt-1 text-[13px] text-text-2">
              {connected
                ? sync.connection?.providerUserId
                  ? `Connected as ${sync.connection.providerUserId}`
                  : "Connected"
                : "Not connected"}
            </p>
          </div>
          <SettingsStatusBadge tone={connected ? "active" : "neutral"}>
            {connected ? "Active" : "Off"}
          </SettingsStatusBadge>
        </div>

        {hasAppCredentials ? (
          <form action="/api/providers/trakt/connect" method="get">
            <SettingsActionButton type="submit">
              {connected ? "Reconnect Trakt" : "Authorize Trakt"}
            </SettingsActionButton>
          </form>
        ) : (
          <SettingsActionButton
            type="button"
            disabled
            tone="neutral"
          >
            Save credentials first
          </SettingsActionButton>
        )}

        {connected ? (
          <form action={disconnectTraktAction}>
            <SettingsActionButton type="submit" tone="danger">
              Disconnect Trakt
            </SettingsActionButton>
          </form>
        ) : null}
      </SettingsPanel>

      <TraktSyncControls initialSync={sync} />
    </main>
  );
}

function requestOrigin(headerStore: Headers) {
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";

  return `${proto}://${host}`;
}
