import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { isAppError } from "@/lib/errors";
import { backfillCurrentUserTmdbMetadata } from "@/lib/providers/tmdb/enrichment";
import { normalizeTmdbBackfillCallBudget } from "@/lib/providers/tmdb/enrichment-state";
import {
  checkRateLimit,
  rateLimitResponse,
  requestRateLimitKey,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to backfill TMDB metadata." },
        { status: 401 },
      );
    }

    const retryAfter = checkRateLimit({
      key: requestRateLimitKey(request, "tmdb-backfill", user.id),
      limit: 20,
      windowMs: 60 * 1000,
    });

    if (retryAfter) {
      return rateLimitResponse(retryAfter);
    }

    const callBudget = normalizeTmdbBackfillCallBudget(
      Number(
        request.nextUrl.searchParams.get("budget") ??
          request.nextUrl.searchParams.get("limit") ??
          20,
      ),
    );
    const result = await backfillCurrentUserTmdbMetadata({ callBudget });

    return NextResponse.json(result);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Failed to backfill TMDB metadata." },
      { status: 500 },
    );
  }
}
