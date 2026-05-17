"use client";

import { LoaderCircle } from "lucide-react";
import { type FormEvent, useActionState, useState } from "react";

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
  const [pendingIntent, setPendingIntent] = useState<"sign-in" | "sign-up" | null>(null);
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(
    signInWithPassword,
    initialMessage
      ? {
          status: "error",
          message: initialMessage,
        }
      : emptyState,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    setPendingIntent(submitter instanceof HTMLButtonElement && submitter.value === "sign-up"
      ? "sign-up"
      : "sign-in");
  }

  return (
    <form action={formAction} className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          className="text-[15px] leading-[1.4] text-text-2"
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
          className="h-[50px] w-full rounded-xl border border-border bg-surface-muted px-4 text-[17px] outline-none transition-colors placeholder:text-text-muted focus:border-accent"
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-[15px] leading-[1.4] text-text-2"
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
          className="h-[50px] w-full rounded-xl border border-border bg-surface-muted px-4 text-[17px] outline-none transition-colors placeholder:text-text-muted focus:border-accent"
        />
      </div>

      <input type="hidden" name="next" value={next ?? ""} />

      <button
        type="submit"
        name="intent"
        value="sign-in"
        disabled={isPending}
        className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending && pendingIntent === "sign-in" ? (
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
        ) : null}
        Sign in
      </button>

      <button
        type="submit"
        name="intent"
        value="sign-up"
        disabled={isPending}
        className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending && pendingIntent === "sign-up" ? (
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
        ) : null}
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
