import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getAuthCookieOptions, getSupabaseConfig } from "./config";
import { applyAuthHeaders, preventAuthCaching } from "./response";

/** Return this exact response after awaiting auth; replacing it loses cookies. */
export function createRouteClient(
  request: NextRequest,
  response: NextResponse,
) {
  const { url, publishableKey } = getSupabaseConfig();
  preventAuthCaching(response.headers);
  return createServerClient(url, publishableKey, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
        applyAuthHeaders(response.headers, cacheHeaders);
      },
    },
  });
}
