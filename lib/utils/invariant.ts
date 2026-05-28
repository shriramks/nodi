import { AppError } from "@/lib/errors";

export function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new AppError(message, {
      code: "INVARIANT_VIOLATION",
      status: 500,
    });
  }
}
