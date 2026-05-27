import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { createSyncEvent } from "@/lib/db/mutations";
import { getErrorMessage, isAppError } from "@/lib/errors";
import { isTraktSyncControlError, pullTraktSyncWithOptions } from "@/lib/providers/trakt/sync";
import {
  checkRateLimit,
  rateLimitResponse,
  requestRateLimitKey,
} from "@/lib/rate-limit";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let authenticated = false;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to pull Trakt sync." },
        { status: 401 },
      );
    }

    authenticated = true;
    const retryAfter = checkRateLimit({
      key: requestRateLimitKey(request, "trakt-pull", user.id),
      limit: 6,
      windowMs: 10 * 60 * 1000,
    });

    if (retryAfter) {
      return rateLimitResponse(retryAfter);
    }

    const result = await pullTraktSyncWithOptions(request.nextUrl.origin, {
      mode: await readPullMode(request),
    });

    revalidatePath("/library");
    revalidatePath("/wishlist");
    revalidatePath("/stats");
    revalidatePath("/search");

    return NextResponse.json(result);
  } catch (error) {
    if (authenticated && !isTraktSyncControlError(error)) {
      await logSyncRouteFailure("pull", getErrorMessage(error));
    }

    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to pull Trakt sync." }, { status: 500 });
  }
}

async function readPullMode(request: NextRequest) {
  const queryMode = request.nextUrl.searchParams.get("mode");

  if (queryMode === "shows") {
    return "shows" as const;
  }

  try {
    const body = await request.json() as unknown;

    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      (body as { mode?: unknown }).mode === "shows"
    ) {
      return "shows" as const;
    }
  } catch {
    // Empty request bodies keep the default full pull mode.
  }

  return "full" as const;
}

async function logSyncRouteFailure(direction: "pull", message: string) {
  try {
    await createSyncEvent({
      provider: "trakt",
      direction,
      eventType: "trakt.pull.summary",
      status: "error",
      payload: {},
      errorMessage: message,
      processedAt: new Date().toISOString(),
    });
  } catch {
    // Preserve the route's original sync error response.
  }
}
