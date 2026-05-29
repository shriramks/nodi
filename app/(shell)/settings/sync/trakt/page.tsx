import type { Metadata } from "next";
import { headers } from "next/headers";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsErrorModal } from "@/components/settings/settings-error-modal";
import { TraktSyncControls } from "@/components/settings/trakt-sync-controls";
import { PageHeader } from "@/components/ui/section";
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
    <main className="space-y-0">
      <PageHeader
        leading={<BackButton />}
        title="Trakt"
        subtitle="Optional cloud sync for watched history, ratings, and watchlist."
      >
        {connected ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-watched/12 px-2.5 py-1 text-[12px] font-semibold text-watched">
            <span className="h-1.5 w-1.5 rounded-full bg-watched" />
            {sync.connection?.providerUserId ?? "Connected"}
          </span>
        ) : (
          <span className="mt-2 inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-text-muted">
            Not connected
          </span>
        )}
      </PageHeader>

      {params.connected ? (
        <p className="mt-4 text-[13px] text-watched">Trakt connected.</p>
      ) : null}

      {params.error ? (
        <SettingsErrorModal
          action={params.errorAction ?? "update Trakt settings"}
          logKey={params.errorLogKey}
        />
      ) : null}

      {/* App credentials */}
      <section className="pt-8">
        <p className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
          App Credentials
        </p>
        <p className="mb-3 break-all rounded-xl bg-surface-muted px-3 py-2 font-mono text-[11px] text-text-muted">
          {redirectUri}
        </p>
        <form action={saveTraktCredentialsAction} className="space-y-0">
          <div className="h-px bg-divider -mx-4" />
          <div className="flex items-center gap-3 py-3">
            <input
              name="clientId"
              autoComplete="off"
              placeholder={sync.credentials.hasClientId ? "Client ID — saved" : "Client ID"}
              required
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-text-faint"
            />
          </div>
          <div className="h-px bg-divider -mx-4" />
          <div className="flex items-center gap-3 py-3">
            <input
              name="clientSecret"
              autoComplete="off"
              placeholder={sync.credentials.hasClientSecret ? "Client Secret — saved" : "Client Secret"}
              required
              type="password"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-text-faint"
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

      {/* Authorization */}
      <section className="pt-8">
        <p className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
          Authorization
        </p>
        <div className="h-px bg-divider -mx-4" />
        {hasAppCredentials ? (
          <form action="/api/providers/trakt/connect" method="get">
            <button
              type="submit"
              className="flex w-full items-center py-3 text-[15px] font-semibold text-accent"
            >
              {connected ? "Reconnect Trakt" : "Authorize Trakt"}
            </button>
          </form>
        ) : (
          <div className="flex items-center py-3">
            <span className="text-[15px] font-semibold text-text-faint">
              Save credentials first
            </span>
          </div>
        )}
        <div className="h-px bg-divider -mx-4" />
      </section>

      <TraktSyncControls initialSync={sync} />

      {connected ? (
        <section className="pt-6">
          <div className="h-px bg-divider -mx-4" />
          <form action={disconnectTraktAction}>
            <button
              type="submit"
              className="flex w-full items-center py-3 text-[15px] font-semibold text-unsynced"
            >
              Disconnect Trakt
            </button>
          </form>
          <div className="h-px bg-divider -mx-4" />
        </section>
      ) : null}
    </main>
  );
}

function requestOrigin(headerStore: Headers) {
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
