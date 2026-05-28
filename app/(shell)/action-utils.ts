import { AppError } from "@/lib/errors";

export function normalizeTmdbId(value: number, label = "TMDB id") {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(`Invalid ${label}.`, {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return value;
}

export function watchDateToTimestamp(value: string) {
  if (typeof value !== "string") {
    throw new AppError("Invalid watch date.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const watchedDate = value.trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(watchedDate) ||
    Number.isNaN(Date.parse(`${watchedDate}T00:00:00.000Z`))
  ) {
    throw new AppError("Invalid watch date.", {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  return `${watchedDate}T12:00:00.000Z`;
}
