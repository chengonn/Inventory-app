import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthCookieOptions, getSupabaseConfig, SupabaseConfigurationError } from "../../src/lib/supabase/config";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://inventory-test.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_local_test_only");
});
afterEach(() => vi.unstubAllEnvs());

describe("public Supabase configuration", () => {
  it("accepts HTTPS project/custom domain and exposes only public values", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://must-not-expose");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "must-not-expose");
    expect(getSupabaseConfig()).toEqual({ url: "https://inventory-test.invalid", publishableKey: "sb_publishable_local_test_only" });
  });
  it.each(["", "http://inventory-test.invalid", "https://name:secret@inventory-test.invalid", "https://inventory-test.invalid/?password=secret", "https://inventory-test.invalid/#secret", "not-a-url"])("rejects unsafe/missing URL: %s", (url) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    expect(getSupabaseConfig).toThrow(SupabaseConfigurationError);
  });
  it.each(["", "sb_secret_do_not_expose", "eyJhbGciOiJIUzI1NiJ9.service_role.signature", "postgresql://secret"])("rejects non-publishable key without reflecting its value", (key) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
    expect(getSupabaseConfig).toThrow(SupabaseConfigurationError);
    try { getSupabaseConfig(); } catch (error) {
      if (key) expect(String(error)).not.toContain(key);
    }
  });
  it("uses host-only, SameSite Lax cookies, HTTPS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getAuthCookieOptions()).toEqual({ path: "/", sameSite: "lax", secure: true, httpOnly: false });
    vi.stubEnv("NODE_ENV", "development");
    expect(getAuthCookieOptions().secure).toBe(false);
  });
});
