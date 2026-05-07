import { redirect } from "next/navigation";
import {
  AUTH_ROUTE,
  DEFAULT_AUTHENTICATED_PATH,
} from "@/lib/auth/paths";
import { getCurrentUser } from "@/lib/auth/server";

export default async function Home() {
  const user = await getCurrentUser();

  redirect(user ? DEFAULT_AUTHENTICATED_PATH : AUTH_ROUTE);
}
