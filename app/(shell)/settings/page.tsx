import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Cloud, LogOut } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-[32px] font-bold leading-[1.1]">Settings</h1>
        <p className="mt-1 truncate text-[13px] text-text-2">
          {user.email ?? "Signed in"}
        </p>
      </section>

      <section className="space-y-3">
        <Link
          href="/settings/sync"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 active:bg-tap-active"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-foreground">
            <Cloud aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-foreground">Sync</span>
            <span className="mt-0.5 block text-[13px] text-text-muted">
              Trakt and TMDB credentials
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-text-muted" />
        </Link>
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
