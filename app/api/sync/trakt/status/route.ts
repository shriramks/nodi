import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { getProviderSyncSettings } from "@/lib/db/queries";
import { isAppError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required to read Trakt sync status." },
        { status: 401 },
      );
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
