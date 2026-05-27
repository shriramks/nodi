import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createSyncEvent: vi.fn(),
  getCurrentUser: vi.fn(),
  pullTraktSyncWithOptions: vi.fn(),
  rateLimitResponse: vi.fn(),
  revalidatePath: vi.fn(),
  requestRateLimitKey: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/db/mutations", () => ({
  createSyncEvent: mocks.createSyncEvent,
}));

vi.mock("@/lib/providers/trakt/sync", () => ({
  isTraktSyncControlError: vi.fn(() => false),
  pullTraktSyncWithOptions: mocks.pullTraktSyncWithOptions,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: mocks.rateLimitResponse,
  requestRateLimitKey: mocks.requestRateLimitKey,
}));

import { POST } from "@/app/api/sync/trakt/pull/route";

describe("Trakt pull route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue(null);
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.pullTraktSyncWithOptions.mockResolvedValue({ failed: 0 });
    mocks.requestRateLimitKey.mockReturnValue("rate-limit-key");
  });

  it("defaults to a full movie and TV pull", async () => {
    const request = new NextRequest("https://nodi.test/api/sync/trakt/pull", {
      method: "POST",
    });

    await POST(request);

    expect(mocks.pullTraktSyncWithOptions).toHaveBeenCalledWith("https://nodi.test", {
      mode: "full",
    });
  });

  it("passes TV-only pull mode from request JSON", async () => {
    const request = new NextRequest("https://nodi.test/api/sync/trakt/pull", {
      body: JSON.stringify({ mode: "shows" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    await POST(request);

    expect(mocks.pullTraktSyncWithOptions).toHaveBeenCalledWith("https://nodi.test", {
      mode: "shows",
    });
  });
});
