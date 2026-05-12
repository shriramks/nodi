import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { createSyncEvent } from "@/lib/db/mutations";
import { getErrorMessage, isAppError } from "@/lib/errors";
import { isTraktSyncControlError, pushTraktSync } from "@/lib/providers/trakt/sync";
import {
  checkRateLimit,
  rateLimitResponse,
  requestRateLimitKey,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  let authenticated = false;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to push Trakt sync." },
        { status: 401 },
      );
    }

    authenticated = true;
    const retryAfter = checkRateLimit({
      key: requestRateLimitKey(request, "trakt-push", user.id),
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });

    if (retryAfter) {
      return rateLimitResponse(retryAfter);
    }

    const result = await pushTraktSync(request.nextUrl.origin);

    return NextResponse.json(result);
  } catch (error) {
    if (authenticated && !isTraktSyncControlError(error)) {
      await logSyncRouteFailure("push", getErrorMessage(error));
    }

    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to push Trakt sync." }, { status: 500 });
  }
}

async function logSyncRouteFailure(direction: "push", message: string) {
  try {
    await createSyncEvent({
      provider: "trakt",
      direction,
      eventType: "trakt.push.summary",
      status: "error",
      payload: {},
      errorMessage: message,
      processedAt: new Date().toISOString(),
    });
  } catch {
    // Preserve the route's original sync error response.
  }
}
