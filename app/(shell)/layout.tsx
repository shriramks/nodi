import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { BottomPillNav } from "@/components/navigation/bottom-pill-nav";
import { requireUser } from "@/lib/auth/server";

type ShellLayoutProps = {
  children: ReactNode;
};

export default async function ShellLayout({ children }: ShellLayoutProps) {
  const user = await requireUser();

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(11,132,255,0.15),_transparent_58%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-6 sm:px-5">
        <header className="mb-6 flex items-start justify-between gap-4 rounded-[26px] border border-border bg-surface px-4 py-4 shadow-[0_12px_32px_rgba(30,22,14,0.06)]">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-text-faint">
              Signed in
            </p>
            <p className="mt-2 truncate text-[15px] font-semibold">
              {user.email ?? "Supabase account"}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-text-2">
              User-scoped library, watchlists, and stats resolve against this session.
            </p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-background px-4 text-[12px] font-semibold text-foreground"
            >
              Sign out
            </button>
          </form>
        </header>
        {children}
      </div>
      <BottomPillNav />
    </div>
  );
}
