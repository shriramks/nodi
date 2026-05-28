import { AppError } from "@/lib/errors";
import type {
  Json,
  MovieStatus,
  Provider,
  ProviderConnectionStatus,
  SyncDirection,
  SyncEventStatus,
  WatchLogSource,
} from "@/lib/db/types";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const movieStatuses = ["watched", "to_watch"] as const satisfies readonly MovieStatus[];
const watchLogSources = ["manual", "trakt_sync", "tmdb_sync", "import"] as const satisfies readonly WatchLogSource[];
const providers = ["trakt", "tmdb"] as const satisfies readonly Provider[];
const providerConnectionStatuses = ["active", "revoked", "error"] as const satisfies readonly ProviderConnectionStatus[];
const syncDirections = ["push", "pull"] as const satisfies readonly SyncDirection[];
const syncEventStatuses = ["pending", "success", "error"] as const satisfies readonly SyncEventStatus[];

type RecordPayload = Record<string, unknown>;

export type MoviePayload = {
  tmdbId: number;
  imdbId?: string | null;
  title: string;
  originalTitle?: string | null;
  releaseDate?: string | null;
  primaryGenreId?: number | null;
  primaryGenreName?: string | null;
  originalLanguage?: string | null;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  runtimeMinutes?: number | null;
  tmdbVoteAverage?: number | null;
  tmdbVoteCount?: number | null;
  popularity?: number | null;
};

export type WatchActionPayload = {
  movieId: string;
  status: MovieStatus;
  watchedAt?: string | null;
  source?: WatchLogSource;
  providerEventId?: string | null;
  notes?: string | null;
  personalRating?: number | null;
};

export type TagPayload = {
  name: string;
};

export type RatingPayload = {
  personalRating: number | null;
};

export type SyncEventPayload = {
  provider: Provider;
  direction: SyncDirection;
  eventType: string;
  status: SyncEventStatus;
  payload?: Json;
  errorMessage?: string | null;
  processedAt?: string | null;
};

export type ProviderConnectionPayload = {
  provider: Provider;
  providerUserId?: string | null;
  tokenExpiresAt?: string | null;
  scopes?: string[] | null;
  status?: ProviderConnectionStatus;
  lastValidatedAt?: string | null;
};

export type ProviderConnectionSecretPayload = {
  connectionId: string;
  provider: Provider;
  accessTokenSecretId?: string | null;
  refreshTokenSecretId?: string | null;
};

function validationError(message: string): never {
  throw new AppError(message, {
    code: "VALIDATION_ERROR",
    status: 400,
  });
}

function asRecord(payload: unknown): RecordPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    validationError("Expected an object payload.");
  }

  return payload as RecordPayload;
}

function requiredString(payload: RecordPayload, key: string, maxLength = 500): string {
  const value = payload[key];

  if (typeof value !== "string") {
    validationError(`Expected ${key} to be a string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    validationError(`Expected ${key} to be non-empty.`);
  }

  if (trimmed.length > maxLength) {
    validationError(`Expected ${key} to be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function optionalString(payload: RecordPayload, key: string, maxLength = 1000): string | null {
  const value = payload[key];

  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    validationError(`Expected ${key} to be a string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    validationError(`Expected ${key} to be ${maxLength} characters or fewer.`);
  }

  return trimmed || null;
}

function optionalIsoDate(payload: RecordPayload, key: string): string | null {
  const value = optionalString(payload, key, 10);

  if (value === null) {
    return null;
  }

  if (!isValidIsoDate(value)) {
    validationError(`Expected ${key} to be an ISO date in YYYY-MM-DD format.`);
  }

  return value;
}

function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function optionalIsoTimestamp(payload: RecordPayload, key: string): string | null {
  const value = optionalString(payload, key);

  if (value === null) {
    return null;
  }

  if (Number.isNaN(Date.parse(value))) {
    validationError(`Expected ${key} to be a valid ISO timestamp.`);
  }

  return new Date(value).toISOString();
}

function optionalInteger(
  payload: RecordPayload,
  key: string,
  options: { min?: number; max?: number } = {},
): number | null {
  const value = payload[key];

  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    validationError(`Expected ${key} to be an integer.`);
  }

  if (options.min !== undefined && value < options.min) {
    validationError(`Expected ${key} to be at least ${options.min}.`);
  }

  if (options.max !== undefined && value > options.max) {
    validationError(`Expected ${key} to be at most ${options.max}.`);
  }

  return value;
}

function optionalNumber(
  payload: RecordPayload,
  key: string,
  options: { min?: number; max?: number; maxDecimalPlaces?: number } = {},
): number | null {
  const value = payload[key];

  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    validationError(`Expected ${key} to be a finite number.`);
  }

  if (options.min !== undefined && value < options.min) {
    validationError(`Expected ${key} to be at least ${options.min}.`);
  }

  if (options.max !== undefined && value > options.max) {
    validationError(`Expected ${key} to be at most ${options.max}.`);
  }

  if (
    options.maxDecimalPlaces !== undefined &&
    !Number.isInteger(value * 10 ** options.maxDecimalPlaces)
  ) {
    validationError(`Expected ${key} to use at most ${options.maxDecimalPlaces} decimal place.`);
  }

  return value;
}

function requiredInteger(
  payload: RecordPayload,
  key: string,
  options: { min?: number } = {},
): number {
  const value = optionalInteger(payload, key, options);

  if (value === null) {
    validationError(`Expected ${key} to be present.`);
  }

  return value;
}

function optionalEnum<TValue extends string>(
  payload: RecordPayload,
  key: string,
  values: readonly TValue[],
  fallback: TValue,
) {
  const value = payload[key];

  if (value == null || value === "") {
    return fallback;
  }

  if (typeof value !== "string" || !values.includes(value as TValue)) {
    validationError(`Expected ${key} to be one of: ${values.join(", ")}.`);
  }

  return value as TValue;
}

function requiredEnum<TValue extends string>(
  payload: RecordPayload,
  key: string,
  values: readonly TValue[],
) {
  const value = payload[key];

  if (typeof value !== "string" || !values.includes(value as TValue)) {
    validationError(`Expected ${key} to be one of: ${values.join(", ")}.`);
  }

  return value as TValue;
}

export function validateUuid(value: unknown, label = "id") {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    validationError(`Expected ${label} to be a valid UUID.`);
  }

  return value;
}

export function validateMoviePayload(payload: unknown): MoviePayload {
  const record = asRecord(payload);

  return {
    tmdbId: requiredInteger(record, "tmdbId", { min: 1 }),
    imdbId: optionalString(record, "imdbId", 32),
    title: requiredString(record, "title"),
    originalTitle: optionalString(record, "originalTitle"),
    releaseDate: optionalIsoDate(record, "releaseDate"),
    primaryGenreId: optionalInteger(record, "primaryGenreId", { min: 1 }),
    primaryGenreName: optionalString(record, "primaryGenreName", 120),
    originalLanguage: optionalString(record, "originalLanguage", 16),
    overview: optionalString(record, "overview", 3000),
    posterPath: optionalString(record, "posterPath", 500),
    backdropPath: optionalString(record, "backdropPath", 500),
    runtimeMinutes: optionalInteger(record, "runtimeMinutes", { min: 1 }),
    tmdbVoteAverage: optionalNumber(record, "tmdbVoteAverage", {
      min: 0,
      max: 10,
      maxDecimalPlaces: 1,
    }),
    tmdbVoteCount: optionalInteger(record, "tmdbVoteCount", { min: 0 }),
    popularity: optionalNumber(record, "popularity"),
  };
}

export function validateWatchActionPayload(payload: unknown): WatchActionPayload {
  const record = asRecord(payload);
  const status = requiredEnum(record, "status", movieStatuses);
  const watchedAt = optionalIsoTimestamp(record, "watchedAt");
  const personalRating = optionalNumber(record, "personalRating", {
    min: 0,
    max: 10,
    maxDecimalPlaces: 1,
  });

  if (status === "watched" && watchedAt === null) {
    validationError("Expected watchedAt when status is watched.");
  }

  const action: WatchActionPayload = {
    movieId: validateUuid(record.movieId, "movieId"),
    status,
    watchedAt,
    source: optionalEnum(record, "source", watchLogSources, "manual"),
    providerEventId: optionalString(record, "providerEventId", 180),
    notes: optionalString(record, "notes", 2000),
  };

  if (Object.hasOwn(record, "personalRating")) {
    action.personalRating = personalRating;
  }

  return action;
}

export function validateTagPayload(payload: unknown): TagPayload {
  const record = asRecord(payload);
  return {
    name: requiredString(record, "name", 80),
  };
}

export function validateRatingPayload(payload: unknown): RatingPayload {
  const record = asRecord(payload);

  return {
    personalRating: optionalNumber(record, "personalRating", {
      min: 0,
      max: 10,
      maxDecimalPlaces: 1,
    }),
  };
}

export function validateProviderConnectionPayload(payload: unknown): ProviderConnectionPayload {
  const record = asRecord(payload);
  const scopes = record.scopes;

  if (
    scopes !== undefined &&
    scopes !== null &&
    (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== "string"))
  ) {
    validationError("Expected scopes to be an array of strings.");
  }

  return {
    provider: requiredEnum(record, "provider", providers),
    providerUserId: optionalString(record, "providerUserId", 180),
    tokenExpiresAt: optionalIsoTimestamp(record, "tokenExpiresAt"),
    scopes: scopes ? scopes.map((scope) => scope.trim()).filter(Boolean) : null,
    status: optionalEnum(record, "status", providerConnectionStatuses, "active"),
    lastValidatedAt: optionalIsoTimestamp(record, "lastValidatedAt"),
  };
}

export function validateProviderConnectionSecretPayload(
  payload: unknown,
): ProviderConnectionSecretPayload {
  const record = asRecord(payload);

  return {
    connectionId: validateUuid(record.connectionId, "connectionId"),
    provider: requiredEnum(record, "provider", providers),
    accessTokenSecretId: record.accessTokenSecretId
      ? validateUuid(record.accessTokenSecretId, "accessTokenSecretId")
      : null,
    refreshTokenSecretId: record.refreshTokenSecretId
      ? validateUuid(record.refreshTokenSecretId, "refreshTokenSecretId")
      : null,
  };
}

export function validateSyncEventPayload(payload: unknown): SyncEventPayload {
  const record = asRecord(payload);
  const eventPayload = record.payload;

  if (eventPayload !== undefined && (!eventPayload || typeof eventPayload !== "object")) {
    validationError("Expected payload to be an object when provided.");
  }

  return {
    provider: requiredEnum(record, "provider", providers),
    direction: requiredEnum(record, "direction", syncDirections),
    eventType: requiredString(record, "eventType", 120),
    status: requiredEnum(record, "status", syncEventStatuses),
    payload: eventPayload ? (eventPayload as Json) : {},
    errorMessage: optionalString(record, "errorMessage", 2000),
    processedAt: optionalIsoTimestamp(record, "processedAt"),
  };
}
