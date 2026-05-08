import type { Metadata } from "next";

import { SignInForm } from "@/components/auth/sign-in-form";
import { normalizeNextPath } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: "Sign In",
};

type AuthPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
    message?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const next = normalizeNextPath(params.next);
  const message = params.error ?? params.message;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-[11px] font-medium uppercase text-text-faint">
          Nodi
        </p>
        <h1 className="mt-2 text-[32px] font-bold leading-[1.1]">Sign in</h1>
        <p className="mt-3 max-w-sm text-[15px] leading-[1.4] text-text-2">
          Continue to your watched movies, watchlist, and stats.
        </p>

        <div className="mt-8">
          <SignInForm next={next} initialMessage={message} />
        </div>
      </section>
    </main>
  );
}
