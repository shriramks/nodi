import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { isAppError } from "@/lib/errors";
import { cancelActiveTraktSync } from "@/lib/providers/trakt/sync";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to stop Trakt sync." },
        { status: 401 },
      );
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
