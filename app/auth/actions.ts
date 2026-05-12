"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_ROUTE,
  normalizeNextPath,
} from "@/lib/auth/paths";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "success" | "error";
  message: string;
};

const minimumPasswordLength = 8;

export async function signInWithPassword(
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

  const password = String(formData.get("password") ?? "");

  if (password.length < minimumPasswordLength) {
    return {
      status: "error",
      message: `Enter a password with at least ${minimumPasswordLength} characters.`,
    };
  }

  const next = normalizeNextPath(formData.get("next"));
  const intent = formData.get("intent") === "sign-up" ? "sign-up" : "sign-in";
  const retryAfter = await checkAuthRateLimit(email);

  if (retryAfter) {
    return {
      status: "error",
      message: "Too many sign-in attempts. Try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();

  if (intent === "sign-up") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return {
        status: "error",
        message: error.message,
      };
    }

    if (!data.session) {
      return {
        status: "success",
        message: "Check your email to confirm your account, then sign in.",
      };
    }

    redirect(next);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();
  redirect(AUTH_ROUTE);
}

async function checkAuthRateLimit(email: string) {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || "unknown";

  return checkRateLimit({
    key: `auth:${ip}:${email}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
}
