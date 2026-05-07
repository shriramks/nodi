import { AppError } from "@/lib/errors";

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
