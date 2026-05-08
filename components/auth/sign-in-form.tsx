"use client";

import { useActionState } from "react";

import {
  signInWithPassword,
  type SignInState,
} from "@/app/auth/actions";

type SignInFormProps = {
  next?: string;
  initialMessage?: string;
};

const emptyState: SignInState = {
  status: "idle",
  message: "",
};

export function SignInForm({
  next,
  initialMessage,
}: SignInFormProps) {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(
    signInWithPassword,
    initialMessage
      ? {
          status: "error",
          message: initialMessage,
        }
      : emptyState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label
          className="text-[12px] font-medium uppercase tracking-[0.22em] text-text-faint"
          htmlFor="email"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="h-13 w-full rounded-[20px] border border-border bg-surface px-4 text-[16px] outline-none transition-colors placeholder:text-text-muted focus:border-foreground"
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-[12px] font-medium uppercase tracking-[0.22em] text-text-faint"
          htmlFor="password"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          placeholder="••••••••"
          className="h-13 w-full rounded-[20px] border border-border bg-surface px-4 text-[16px] outline-none transition-colors placeholder:text-text-muted focus:border-foreground"
        />
      </div>

      <input type="hidden" name="next" value={next ?? ""} />

      <button
        type="submit"
        name="intent"
        value="sign-in"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-4 text-[14px] font-semibold text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>

      <button
        type="submit"
        name="intent"
        value="sign-up"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center rounded-full border border-border bg-surface px-4 text-[14px] font-semibold text-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        Create account
      </button>

      {state.message ? (
        <p
          className={`text-[13px] leading-5 ${
            state.status === "error" ? "text-danger" : "text-accent"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
