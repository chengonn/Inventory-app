import { GUEST_COOKIE } from "@/lib/auth/guest";
import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthCookieOptions,
  getSupabaseConfig,
  SupabaseConfigurationError,
} from "./config";
import { applyAuthHeaders, preventAuthCaching } from "./response";
import { verifyActor } from "@/lib/auth/policy";

/** Refresh infrastructure only. Step 4 adds authorization at each data entry. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  preventAuthCaching(response.headers);
  try {
    const { url, publishableKey } = getSupabaseConfig();
    const pending = new Map<
      string,
      { value: string; options: CookieOptions }
    >();
    const savedHeaders: Record<string, string> = {};
    const supabase = createServerClient(url, publishableKey, {
      cookieOptions: getAuthCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            pending.set(name, { value, options });
          });
          Object.assign(savedHeaders, cacheHeaders);
          // Forward fresh cookies to downstream Server Components, not to
          // browser response headers. Preserve ALL earlier writes/chunks.
          response = NextResponse.next({ request });
          pending.forEach(({ value, options }, name) =>
            response.cookies.set(name, value, options),
          );
          // SSR 0.12 sends cache headers only on the first cookie write.
          applyAuthHeaders(response.headers, savedHeaders);
        },
      },
    });

    // Must run immediately, before rendering. Never authorize with getSession.
    const { data, error } = await supabase.auth.getClaims();
    if (
      error &&
      (isAuthRetryableFetchError(error) ||
        error.status === 429 ||
        (error.status ?? 0) >= 500)
    ) {
      return unavailable(response, "登入服務暫時無法使用，請稍後重試。");
    }
    if (data?.claims?.sub) {
      const actor = await verifyActor(supabase, request.cookies.get(GUEST_COOKIE)?.value ?? "");
      if (actor.status === "unavailable")
        return unavailable(response, "登入服務或白名單設定暫時無法使用。");
      if (actor.status === "forbidden") {
        const { error: signOutError } = await supabase.auth.signOut({
          scope: "local",
        });
        if (signOutError)
          return unavailable(response, "無法清除未授權 session，請稍後重試。");
        const denied = request.nextUrl.pathname.startsWith("/api/")
          ? new NextResponse(null, { status: 403 })
          : NextResponse.redirect(
              new URL("/login?reason=forbidden", request.url),
              303,
            );
        response.cookies
          .getAll()
          .forEach((cookie) => denied.cookies.set(cookie));
        preventAuthCaching(denied.headers);
        return denied;
      }
    }
    // Page and API guards independently authorize; Proxy is not the only gate.
    return response;
  } catch (error) {
    return unavailable(
      response,
      error instanceof SupabaseConfigurationError
        ? error.message
        : "登入服務暫時無法使用，請稍後重試。",
    );
  }
}

function unavailable(previous: NextResponse, message: string) {
  const response = new NextResponse(message, {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
  previous.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  preventAuthCaching(response.headers);
  return response;
}
