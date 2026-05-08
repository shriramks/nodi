import type { ReactNode } from "react";
import { Settings } from "lucide-react";
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
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-6">
        <header className="relative mb-6 flex h-12 items-center justify-between">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold leading-none">Nodi</p>
            <p className="mt-1 truncate text-[13px] text-text-2">Movie tracker</p>
          </div>

          <details className="group">
            <summary
              aria-label="Settings"
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-border bg-surface text-foreground marker:hidden transition-colors group-open:bg-tap-active"
            >
              <Settings aria-hidden="true" className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 top-14 z-50 w-72 rounded-2xl border border-border bg-surface p-4">
              <p className="text-[11px] uppercase text-text-faint">Signed in</p>
              <p className="mt-2 truncate text-[15px] text-foreground">
                {user.email ?? "Supabase account"}
              </p>
              <form action={signOut} className="mt-4">
                <button
                  type="submit"
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-[15px] font-semibold text-foreground"
                >
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </header>
        {children}
      </div>
      <BottomPillNav />
    </div>
  );
}
