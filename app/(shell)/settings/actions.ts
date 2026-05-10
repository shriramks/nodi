"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { upsertUserPreferences } from "@/lib/db/mutations/preferences";
import type { Theme } from "@/lib/db/types";

export async function updateThemeAction(theme: Theme) {
  const jar = await cookies();
  if (theme === "auto") {
    jar.delete("nodi-theme");
  } else {
    jar.set("nodi-theme", theme, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false, // readable client-side for instant DOM update
    });
  }

  await upsertUserPreferences({ theme: theme === "auto" ? null : theme });
  revalidatePath("/", "layout");
}
