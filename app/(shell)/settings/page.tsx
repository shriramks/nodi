import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Cloud, LogOut } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth/server";
import { AppearancePicker } from "@/components/settings/appearance-picker";
import { PageHeader, Section, SectionHeader } from "@/components/ui/section";
import { SettingsLinkRow } from "@/components/ui/settings";
import type { Theme } from "@/lib/db/types";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const jar = await cookies();
  const rawTheme = jar.get("nodi-theme")?.value;
  const theme: Theme = rawTheme === "light" || rawTheme === "dark" ? rawTheme : "auto";

  return (
    <main className="space-y-6">
      <PageHeader title="Settings">
        <p className="mt-1 truncate text-[13px] leading-[1.4] text-text-2">
          {user.email ?? "Signed in"}
        </p>
      </PageHeader>

      <Section>
        <SectionHeader className="px-1 font-semibold text-text-faint">Appearance</SectionHeader>
        <AppearancePicker current={theme} />
      </Section>

      <section className="space-y-3">
        <SettingsLinkRow
          href="/settings/sync"
          icon={<Cloud aria-hidden="true" className="h-5 w-5" />}
          title="Sync"
          description="TMDB required. Trakt sync optional."
        />
      </section>

      <form action={signOut}>
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-unsynced transition-opacity active:opacity-70"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </main>
  );
}
