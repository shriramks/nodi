import { AppError } from "@/lib/errors";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function withJsonHeaders(headers?: HeadersInit) {
  const normalizedHeaders = new Headers(headers);

  if (!normalizedHeaders.has("accept")) {
    normalizedHeaders.set("accept", "application/json");
  }

  return normalizedHeaders;
}

async function parseErrorPayload(response: Response) {
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    const payload = (await response.json()) as { error?: string; message?: string };
    return {
      details: payload,
      message: payload.message ?? payload.error ?? httpErrorMessage(response),
    };
  }

  const payload = await response.text();
  return {
    details: {
      body: payload,
      contentType,
    },
    message: httpErrorMessage(response),
  };
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);

    throw new AppError(errorPayload.message, {
      cause: errorPayload.details,
      code: "HTTP_ERROR",
      status: response.status,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    throw new AppError("Expected a JSON response.", {
      code: "INVALID_RESPONSE",
      status: 502,
    });
  }

  return (await response.json()) as T;
}

function httpErrorMessage(response: Response) {
  return response.statusText
    ? `HTTP ${response.status}: ${response.statusText}`
    : `HTTP ${response.status} request failed.`;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, {
      ...init,
      headers: withJsonHeaders(init?.headers),
    });
  } catch (error) {
    throw new AppError("Network request failed.", {
      cause: error,
      code: "NETWORK_ERROR",
      status: 503,
    });
  }

  return parseJsonResponse<T>(response);
}

export type { JsonValue };
