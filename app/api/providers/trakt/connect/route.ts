import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { AUTH_ROUTE } from "@/lib/auth/paths";
import { getTraktAuthorizeUrl } from "@/lib/providers/trakt/client";
import {
  getTraktRedirectUri,
  loadTraktAppCredentials,
} from "@/lib/providers/trakt/credentials";

const stateCookieName = "nodi_trakt_oauth_state";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL(AUTH_ROUTE, request.url));
  }

  try {
    const { clientId } = await loadTraktAppCredentials(user.id);
    const state = crypto.randomUUID();
    const authorizeUrl = getTraktAuthorizeUrl({
      clientId,
      redirectUri: getTraktRedirectUri(request.nextUrl.origin),
      state,
    });
    const response = NextResponse.redirect(authorizeUrl);

    response.cookies.set(stateCookieName, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/api/providers/trakt/callback",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });

    return response;
  } catch (error) {
    const url = new URL("/settings/sync/trakt", request.url);
    url.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Unable to start Trakt authorization.",
    );
    return NextResponse.redirect(url);
  }
}
