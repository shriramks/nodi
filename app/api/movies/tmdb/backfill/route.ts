import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { isAppError } from "@/lib/errors";
import { backfillCurrentUserTmdbMetadata } from "@/lib/providers/tmdb/enrichment";
import { normalizeTmdbBackfillLimit } from "@/lib/providers/tmdb/enrichment-state";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to backfill TMDB metadata." },
        { status: 401 },
      );
    }

    const limit = normalizeTmdbBackfillLimit(
      Number(request.nextUrl.searchParams.get("limit") ?? 20),
    );
    const result = await backfillCurrentUserTmdbMetadata({ limit });

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
