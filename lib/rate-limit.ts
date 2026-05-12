import "server-only";

import { NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitState>();

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return null;
  }

  bucket.count += 1;

  if (bucket.count <= limit) {
    return null;
  }

  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    {
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
      status: 429,
    },
  );
}

export function requestRateLimitKey(request: Request, scope: string, subject?: string | null) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || forwardedHost || "unknown";

  return [scope, subject ?? ip].join(":");
}
