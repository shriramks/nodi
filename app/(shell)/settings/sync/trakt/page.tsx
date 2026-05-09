import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { BackButton } from "@/components/navigation/back-button";
import { TraktSyncControls } from "@/components/settings/trakt-sync-controls";
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
      <section>
        <BackButton />
        <h1 className="mt-2 text-[32px] font-bold leading-[1.1]">Trakt Sync</h1>
        <p className="mt-1 text-[13px] text-text-2">
          Uses your own Trakt API app and your own Trakt authorization.
        </p>
      </section>

      {params.connected ? (
        <p className="rounded-2xl border border-border bg-surface p-3 text-[13px] text-watched">
          Trakt connected.
        </p>
      ) : null}

      {params.error ? (
        <p className="rounded-2xl border border-border bg-surface p-3 text-[13px] leading-[1.4] text-unsynced">
          {params.error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
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
            <span className="text-[13px] text-text-muted">Client ID</span>
            <input
              name="clientId"
              autoComplete="off"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[15px] outline-none focus:border-accent"
              placeholder={sync.credentials.hasClientId ? "Saved. Enter to replace." : ""}
              required
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-text-muted">Client Secret</span>
            <input
              name="clientSecret"
              autoComplete="off"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[15px] outline-none focus:border-accent"
              placeholder={sync.credentials.hasClientSecret ? "Saved. Enter to replace." : ""}
              required
              type="password"
            />
          </label>
          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent"
          >
            Save Trakt App Credentials
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
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
          <span
            className={[
              "rounded-full px-2.5 py-1 text-[12px] font-semibold",
              connected ? "bg-watched/15 text-watched" : "bg-surface-muted text-text-2",
            ].join(" ")}
          >
            {connected ? "Active" : "Off"}
          </span>
        </div>

        {hasAppCredentials ? (
          <Link
            href="/api/providers/trakt/connect"
            className="flex h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-[15px] font-semibold text-foreground"
          >
            {connected ? "Reconnect Trakt" : "Authorize Trakt"}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="h-11 rounded-xl border border-border bg-background px-4 text-[15px] font-semibold text-text-muted opacity-50"
          >
            Save credentials first
          </button>
        )}

        {connected ? (
          <form action={disconnectTraktAction}>
            <button
              type="submit"
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-[15px] font-semibold text-unsynced"
            >
              Disconnect Trakt
            </button>
          </form>
        ) : null}
      </section>

      <TraktSyncControls initialSync={sync} />
    </main>
  );
}

function requestOrigin(headerStore: Headers) {
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";

  return `${proto}://${host}`;
}
