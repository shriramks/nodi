import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { AUTH_ROUTE } from "@/lib/auth/paths";
import { isAppError } from "@/lib/errors";
import { providerErrorRedirect } from "@/lib/providers/provider-error-redirect";
import { exchangeTraktCode, getTraktUserSettings } from "@/lib/providers/trakt/client";
import {
  getTraktRedirectUri,
  hasActiveTraktOAuthConnection,
  loadTraktAppCredentials,
  saveTraktOAuthTokens,
} from "@/lib/providers/trakt/credentials";
import {
  checkRateLimit,
  rateLimitResponse,
  requestRateLimitKey,
} from "@/lib/rate-limit";

const stateCookieName = "nodi_trakt_oauth_state";

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/settings/sync/trakt", request.url);
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL(AUTH_ROUTE, request.url));
  }

  const retryAfter = checkRateLimit({
    key: requestRateLimitKey(request, "trakt-callback", user.id),
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (retryAfter) {
    return rateLimitResponse(retryAfter);
  }

  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return withClearedStateCookie(providerErrorRedirect({
      action: "authorize Trakt",
      error: {
        error,
        errorDescription: request.nextUrl.searchParams.get("error_description"),
      },
      label: "Trakt OAuth provider rejected authorization",
      redirectUrl,
    }));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(stateCookieName)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    if (code && state && await hasActiveTraktOAuthConnection(user.id)) {
      return redirectConnected(redirectUrl);
    }

    return withClearedStateCookie(providerErrorRedirect({
      action: "validate Trakt authorization state",
      error: {
        hasCode: Boolean(code),
        hasExpectedState: Boolean(expectedState),
        hasState: Boolean(state),
        stateMatches: Boolean(state && expectedState && state === expectedState),
      },
      label: "Trakt OAuth state validation failed",
      redirectUrl,
    }));
  }

  try {
    const app = await loadTraktAppCredentials(user.id);
    const tokens = await exchangeTraktCode({
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      code,
      redirectUri: getTraktRedirectUri(request.nextUrl.origin),
    });
    const settings = await getTraktUserSettings({
      accessToken: tokens.access_token,
      clientId: app.clientId,
    });
    const providerUserId = settings.user?.ids?.slug ?? settings.user?.username ?? null;

    await saveTraktOAuthTokens(user.id, tokens, { providerUserId });
    redirectUrl.searchParams.set("connected", "1");
  } catch (callbackError) {
    if (
      isInvalidGrant(callbackError) &&
      await hasActiveTraktOAuthConnection(user.id)
    ) {
      return redirectConnected(redirectUrl);
    }

    return withClearedStateCookie(providerErrorRedirect({
      action: "finish Trakt authorization",
      error: callbackError,
      label: "Trakt OAuth callback failed",
      redirectUrl,
    }));
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(stateCookieName, "", {
    maxAge: 0,
    path: "/api/providers/trakt/callback",
  });
  return response;
}

function redirectConnected(redirectUrl: URL) {
  redirectUrl.searchParams.set("connected", "1");
  return withClearedStateCookie(NextResponse.redirect(redirectUrl));
}

function withClearedStateCookie(response: Response) {
  response.headers.append(
    "set-cookie",
    `${stateCookieName}=; Max-Age=0; Path=/api/providers/trakt/callback; SameSite=Lax`,
  );
  return response;
}

function isInvalidGrant(error: unknown) {
  if (!isAppError(error)) {
    return false;
  }

  if (error.message === "invalid_grant") {
    return true;
  }

  const cause = error.cause;

  return Boolean(
    cause &&
      typeof cause === "object" &&
      "error" in cause &&
      cause.error === "invalid_grant",
  );
}
