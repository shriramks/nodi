import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cloud, Database } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsLinkRow, SettingsStatusBadge } from "@/components/ui/settings";
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
    <SettingsLinkRow
      href={href}
      icon={icon}
      title={label}
      titleAccessory={<SettingsStatusBadge size="compact">{note}</SettingsStatusBadge>}
      description={description}
      status={status}
    />
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
