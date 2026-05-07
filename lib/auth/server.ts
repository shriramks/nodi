import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { AUTH_ROUTE } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(AUTH_ROUTE);
  }

  return user;
}
