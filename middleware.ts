import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_ROUTE,
  DEFAULT_AUTHENTICATED_PATH,
  isProtectedRoute,
  normalizeNextPath,
} from "@/lib/auth/paths";
import { publicEnv } from "@/lib/env/public";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(
        user ? DEFAULT_AUTHENTICATED_PATH : AUTH_ROUTE,
        request.url,
      ),
    );
  }

  if (!user && isProtectedRoute(pathname)) {
    const signInUrl = new URL(AUTH_ROUTE, request.url);
    signInUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(signInUrl);
  }

  if (user && pathname === AUTH_ROUTE) {
    const next = normalizeNextPath(request.nextUrl.searchParams.get("next"));

    return NextResponse.redirect(new URL(next, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
