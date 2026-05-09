import "server-only";

import { serializeError } from "@/lib/errors";

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
  const serializedError = serializeError(error);

  console.error(label, serializedError);

  redirectUrl.searchParams.set("error", `Could not ${action}`);
  redirectUrl.searchParams.set("errorAction", action);
  redirectUrl.searchParams.set("errorLogKey", errorLogKey);

  return new Response(providerErrorRedirectHtml({
    errorLogKey,
    redirectUrl: redirectUrl.toString(),
    serializedError,
  }), {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function providerErrorRedirectHtml({
  errorLogKey,
  redirectUrl,
  serializedError,
}: {
  errorLogKey: string;
  redirectUrl: string;
  serializedError: unknown;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nodi</title>
  </head>
  <body>
    <script>
      (function () {
        var key = ${safeScriptJson(errorLogKey)};
        var error = ${safeScriptJson(serializedError)};
        var redirectUrl = ${safeScriptJson(redirectUrl)};

        try {
          window.sessionStorage.setItem(key, JSON.stringify(error));
        } catch (storageError) {
          console.error("Nodi could not save provider error details.", storageError);
        }

        console.error("Nodi provider error", error);
        window.location.replace(redirectUrl);
      })();
    </script>
    <p>Error: Could not finish provider authorization. Logs in console.</p>
  </body>
</html>`;
}

function safeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
