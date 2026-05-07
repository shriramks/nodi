export const AUTH_ROUTE = "/auth";
export const DEFAULT_AUTHENTICATED_PATH = "/movies";

const protectedRoutePrefixes = [
  "/movies",
  "/to-watch",
  "/stats",
  "/search",
  "/movie",
] as const;

export function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function normalizeNextPath(
  value: FormDataEntryValue | string | null | undefined,
) {
  if (typeof value !== "string") {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  if (value === AUTH_ROUTE || value.startsWith(`${AUTH_ROUTE}/`)) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  return value;
}
