import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { isAppError } from "@/lib/errors";
import { cancelActiveTraktSync } from "@/lib/providers/trakt/sync";
import {
  checkRateLimit,
  rateLimitResponse,
  requestRateLimitKey,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to stop Trakt sync." },
        { status: 401 },
      );
    }

    const retryAfter = checkRateLimit({
      key: requestRateLimitKey(request, "trakt-stop", user.id),
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });

    if (retryAfter) {
      return rateLimitResponse(retryAfter);
    }

    const run = await cancelActiveTraktSync();

    return NextResponse.json({
      stopped: Boolean(run),
      runId: run?.id ?? null,
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to stop Trakt sync." }, { status: 500 });
  }
}
