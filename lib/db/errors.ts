import { AppError } from "@/lib/errors";

export function throwDatabaseError(message: string, cause: unknown): never {
  throw new AppError(message, {
    cause,
    code: "DATABASE_ERROR",
    status: 500,
  });
}

export function throwNotFound(message: string): never {
  throw new AppError(message, {
    code: "NOT_FOUND",
    status: 404,
  });
}
