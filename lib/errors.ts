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
