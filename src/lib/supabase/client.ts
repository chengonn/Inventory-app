"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getAuthCookieOptions, getSupabaseConfig } from "./config";

/** Auth only. Business data must go through server-side Prisma services. */
export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey, {
    cookieOptions: getAuthCookieOptions(),
  });
}
