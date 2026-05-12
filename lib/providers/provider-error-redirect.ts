import "server-only";

import { NextResponse } from "next/server";

type ProviderErrorRedirectOptions = {
  action: string;
  error: unknown;
  label: string;
  redirectUrl: URL;
};

export function providerErrorRedirect({
  action,
  error,
  label,
  redirectUrl,
}: ProviderErrorRedirectOptions) {
  const errorLogKey = `nodi-provider-error:${crypto.randomUUID()}`;

  console.error(label, {
    errorLogKey,
    error,
  });

  redirectUrl.searchParams.set("error", `Could not ${action}`);
  redirectUrl.searchParams.set("errorAction", action);
  redirectUrl.searchParams.set("errorLogKey", errorLogKey);

  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("cache-control", "no-store");
  return response;
}
