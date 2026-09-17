/** Only public values belong here: this module is also imported by the browser. */
export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase 設定未完成。請設定有效的 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。");
    this.name = "SupabaseConfigurationError";
  }
}

export function getSupabaseConfig() {
  // Keep direct property access: Next.js inlines NEXT_PUBLIC_* at build time.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    // Never include the supplied value; it might accidentally be a secret key.
    throw new SupabaseConfigurationError();
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.search || parsed.hash || parsed.pathname !== "/") {
      throw new SupabaseConfigurationError();
    }
    return { url: parsed.origin, publishableKey };
  } catch {
    throw new SupabaseConfigurationError();
  }
}

export function getAuthCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    // Supabase SSR's browser client must read and refresh these auth cookies.
    // This is NOT a cookie containing database or service-role credentials.
    httpOnly: false,
  };
}
