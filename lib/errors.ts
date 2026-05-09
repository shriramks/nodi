export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, options?: { cause?: unknown; code?: string; status?: number }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = options?.code ?? "APP_ERROR";
    this.status = options?.status ?? 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export function serializeError(error: unknown): unknown {
  return serializeErrorValue(error, new WeakSet<object>());
}

function serializeErrorValue(error: unknown, seen: WeakSet<object>): unknown {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };

    if ("code" in error) {
      serialized.code = error.code;
    }

    if ("status" in error) {
      serialized.status = error.status;
    }

    if ("cause" in error) {
      serialized.cause = serializeErrorValue(error.cause, seen);
    }

    return serialized;
  }

  if (!error || typeof error !== "object") {
    return error;
  }

  if (seen.has(error)) {
    return "[Circular]";
  }

  seen.add(error);

  if (Array.isArray(error)) {
    return error.map((item) => serializeErrorValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(error).map(([key, value]) => [
      key,
      serializeErrorValue(value, seen),
    ]),
  );
}
