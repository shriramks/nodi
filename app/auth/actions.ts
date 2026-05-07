"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_ROUTE,
  normalizeNextPath,
} from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "success" | "error";
  message: string;
};

function buildRequestOrigin(
  requestHeaders: Awaited<ReturnType<typeof headers>>,
) {
  const origin = requestHeaders.get("origin");

  if (origin) {
    return origin;
  }

  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    throw new Error("Unable to determine the request host for auth redirects.");
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

export async function signInWithEmail(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return {
      status: "error",
      message: "Enter the email address tied to your account.",
    };
  }

  const next = normalizeNextPath(formData.get("next"));
  const callbackUrl = new URL(
    "/auth/callback",
    buildRequestOrigin(await headers()),
  );
  callbackUrl.searchParams.set("next", next);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "success",
    message: "Check your email for the sign-in link.",
  };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();
  redirect(AUTH_ROUTE);
}
