import { cookies } from "next/headers";
import { signOut } from "@/app/auth/actions";
import { SettingsPopover } from "./settings-popover";
import type { Theme } from "@/lib/db/types";

export async function SettingsSheet() {
  const jar = await cookies();
  const raw = jar.get("nodi-theme")?.value;
  const theme: Theme = raw === "light" || raw === "dark" ? raw : "auto";
  return <SettingsPopover theme={theme} signOut={signOut} />;
}
