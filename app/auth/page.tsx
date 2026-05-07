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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-5">
      <section className="rounded-[32px] border border-border bg-surface px-5 py-6 shadow-[0_24px_60px_rgba(30,22,14,0.08)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-text-faint">
          Supabase auth
        </p>
        <h1 className="mt-3 text-[34px] font-bold leading-none tracking-[-0.04em]">
          Sign in to your library
        </h1>
        <p className="mt-3 max-w-sm text-[14px] leading-6 text-text-2">
          Nodi keeps watched history, watchlists, and stats scoped to the authenticated user from the
          start. Use your email link to enter the app shell.
        </p>

        <div className="mt-8">
          <SignInForm next={next} initialMessage={message} />
        </div>
      </section>
    </main>
  );
}
