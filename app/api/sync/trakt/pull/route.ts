import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { createSyncEvent } from "@/lib/db/mutations";
import { getErrorMessage, isAppError } from "@/lib/errors";
import { pullTraktSync } from "@/lib/providers/trakt/sync";

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
    const result = await pullTraktSync(request.nextUrl.origin);

    revalidatePath("/movies");
    revalidatePath("/to-watch");
    revalidatePath("/stats");
    revalidatePath("/search");

    return NextResponse.json(result);
  } catch (error) {
    if (authenticated) {
      await logSyncRouteFailure("pull", getErrorMessage(error));
    }

    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to pull Trakt sync." }, { status: 500 });
  }
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
