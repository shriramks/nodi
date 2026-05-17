import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Cloud, Database } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { getProviderSyncSettings } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Sync Settings",
};

export default async function SyncSettingsPage() {
  const [trakt, tmdb] = await Promise.all([
    getProviderSyncSettings("trakt"),
    getProviderSyncSettings("tmdb"),
  ]);

  return (
    <main className="space-y-6">
      <section>
        <BackButton />
        <h1 className="mt-2 text-[32px] font-bold leading-[1.1]">Sync</h1>
        <p className="mt-1 text-[13px] text-text-2">
          TMDB is required for search. Trakt adds optional syncing.
        </p>
      </section>

      <section className="space-y-3">
        <ProviderLink
          href="/settings/sync/tmdb"
          icon={<Database aria-hidden="true" className="h-5 w-5" />}
          label="TMDB"
          note="Required"
          description="For movie search and metadata"
          status={tmdb.credentials.hasApiToken ? "Token saved" : "Token required"}
        />
        <ProviderLink
          href="/settings/sync/trakt"
          icon={<Cloud aria-hidden="true" className="h-5 w-5" />}
          label="Trakt"
          note="Optional"
          description="For cloud syncing"
          status={providerLabel(trakt)}
        />
      </section>
    </main>
  );
}

function ProviderLink({
  href,
  icon,
  label,
  note,
  description,
  status,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  note: string;
  description: string;
  status: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 active:bg-tap-active"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-[15px] font-semibold text-foreground">{label}</span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text-muted">
            {note}
          </span>
        </span>
        <span className="mt-0.5 block text-[13px] text-text-muted">{description}</span>
        <span className="mt-0.5 block text-[12px] text-text-faint">{status}</span>
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-text-muted" />
    </Link>
  );
}

function providerLabel(sync: Awaited<ReturnType<typeof getProviderSyncSettings>>) {
  if (!sync.credentials.hasClientId || !sync.credentials.hasClientSecret) {
    return "App credentials required";
  }

  if (sync.connection?.status !== "active") {
    return "Authorization required";
  }

  return sync.connection.providerUserId
    ? `Connected as ${sync.connection.providerUserId}`
    : "Connected";
}
