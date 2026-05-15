import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { getProviderSyncSettings } from "@/lib/db/queries";
import { isAppError } from "@/lib/errors";
import {
  checkRateLimit,
  rateLimitResponse,
  requestRateLimitKey,
} from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to read Trakt sync status." },
        { status: 401 },
      );
    }

    const retryAfter = checkRateLimit({
      key: requestRateLimitKey(request, "trakt-status", user.id),
      limit: 60,
      windowMs: 60 * 1000,
    });

    if (retryAfter) {
      return rateLimitResponse(retryAfter);
    }

    return NextResponse.json(await getProviderSyncSettings("trakt"));
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Failed to load Trakt sync status." },
      { status: 500 },
    );
  }
}
