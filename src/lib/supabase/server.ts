import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthCookieOptions, getSupabaseConfig } from "./config";

/** Read-only Server Component client. Proxy must refresh before rendering. */
export async function createClient() {
  return createRequestClient(false);
}

/** Only call inside a Server Action, before streaming/redirecting. */
export async function createActionClient() {
  return createRequestClient(true);
}

async function createRequestClient(writable: boolean) {
  const { url, publishableKey } = getSupabaseConfig();
  const store = await cookies();
  // Request-local instance: never share sessions via module scope on Vercel.
  return createServerClient(url, publishableKey, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        // Server Components cannot write cookies. Proxy handles refresh.
        // Do not silently swallow writes/errors from Server Actions.
        if (!writable) return;
        // Next.js headers() is read-only. Proxy unconditionally sets the same
        // no-store headers for ALL matched routes, including Server Actions.
        cookiesToSet.forEach(({ name, value, options }) =>
          store.set(name, value, options),
        );
      },
    },
  });
}
