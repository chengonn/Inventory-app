import type { CookieMethodsServer, CookieOptions } from "@supabase/ssr";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
// Next 16.3.4 docs call this doesProxyMatch, but its shipped export/type
// still uses doesMiddlewareMatch. Use the actually installed public export.
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  server: vi.fn(), browser: vi.fn(), claims: vi.fn(), getAll: vi.fn(), set: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.server, createBrowserClient: mocks.browser }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: mocks.getAll, set: mocks.set }) }));

import { createClient as createBrowser } from "../../src/lib/supabase/client";
import { createClient, createActionClient } from "../../src/lib/supabase/server";
import { createRouteClient } from "../../src/lib/supabase/route-handler";
import { updateSession } from "../../src/lib/supabase/proxy";
import { config } from "../../src/proxy";

type Options = { cookies: CookieMethodsServer; cookieOptions: CookieOptions };
const options = () => mocks.server.mock.lastCall![2] as Options;
const cacheHeaders = { "Cache-Control": "private, no-store", Pragma: "no-cache", Expires: "0" };
const freshCookie = { name: "sb-test-auth-token.0", value: "fresh-token", options: { path: "/", sameSite: "lax" as const, secure: true } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://inventory-test.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_local_test_only");
  mocks.getAll.mockReturnValue([{ name: "sb-test-auth-token.0", value: "old-token" }]);
  mocks.claims.mockResolvedValue({ data: null, error: null });
  mocks.server.mockImplementation(() => ({ auth: { getClaims: mocks.claims } }));
});
afterEach(() => vi.unstubAllEnvs());

describe("client adapters", () => {
  it("browser factory passes only the public key and matching cookie policy", () => {
    createBrowser();
    expect(mocks.browser).toHaveBeenCalledWith("https://inventory-test.invalid", "sb_publishable_local_test_only", {
      cookieOptions: { path: "/", sameSite: "lax", secure: true, httpOnly: false },
    });
  });
  it("server instances are request-local and read-only by default", async () => {
    expect(await createClient()).not.toBe(await createClient());
    expect(options().cookies.getAll()).toEqual(mocks.getAll());
    await options().cookies.setAll!([freshCookie], cacheHeaders);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("Server Actions write all cookies, including expired chunks", async () => {
    await createActionClient();
    const removed = { name: "sb-test-auth-token.1", value: "", options: { path: "/", maxAge: 0 } };
    await options().cookies.setAll!([freshCookie, removed], cacheHeaders);
    expect(mocks.set).toHaveBeenCalledWith(freshCookie.name, freshCookie.value, freshCookie.options);
    expect(mocks.set).toHaveBeenCalledWith(removed.name, "", removed.options);
  });
  it("does not swallow a cookie-write failure in a Server Action", async () => {
    await createActionClient();
    mocks.set.mockImplementation(() => { throw new Error("cookies are read-only"); });
    expect(() => options().cookies.setAll!([freshCookie], cacheHeaders)).toThrow("cookies are read-only");
  });
  it("Route Handler preserves cookies, no-store headers and redirect destination", async () => {
    const request = new NextRequest("https://inventory-test.invalid/login");
    const response = NextResponse.redirect("https://inventory-test.invalid/dashboard");
    createRouteClient(request, response);
    await options().cookies.setAll!([freshCookie], cacheHeaders);
    expect(response.headers.get("location")).toBe("https://inventory-test.invalid/dashboard");
    expect(response.cookies.get(freshCookie.name)?.value).toBe("fresh-token");
    expect(request.cookies.get(freshCookie.name)?.value).toBe("fresh-token");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });
});

describe("session Proxy", () => {
  it("verifies with getClaims even when no session exists, with no authorization redirect yet", async () => {
    const response = await updateSession(new NextRequest("https://inventory-test.invalid/dashboard"));
    expect(mocks.claims).toHaveBeenCalledExactlyOnceWith();
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("keeps all cookie chunks and first-write cache headers across repeated setAll calls", async () => {
    const request = new NextRequest("https://inventory-test.invalid/dashboard", { headers: { cookie: "theme=dark" } });
    mocks.claims.mockImplementation(async () => {
      await options().cookies.setAll!([freshCookie], { ...cacheHeaders, "X-Test-Cache-Header": "first-write" });
      await options().cookies.setAll!([{ ...freshCookie, name: "sb-test-auth-token.1", value: "second-chunk" }], {});
      return { data: null, error: null };
    });
    const response = await updateSession(request);
    expect(response.cookies.get(freshCookie.name)?.value).toBe("fresh-token");
    expect(response.cookies.get("sb-test-auth-token.1")?.value).toBe("second-chunk");
    expect(response.headers.get("x-test-cache-header")).toBe("first-write");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("fresh-token");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("theme=dark");
    expect(response.headers.get("cookie")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
  it("preserves deletion cookies when upstream Auth is unavailable", async () => {
    mocks.claims.mockImplementation(async () => {
      await options().cookies.setAll!([{ ...freshCookie, value: "", options: { path: "/", maxAge: 0 } }], cacheHeaders);
      return { data: null, error: new AuthRetryableFetchError("secret-upstream-message", 503) };
    });
    const response = await updateSession(new NextRequest("https://inventory-test.invalid/dashboard"));
    expect(response.status).toBe(503);
    expect(response.cookies.get(freshCookie.name)?.maxAge).toBe(0);
    expect(await response.text()).not.toContain("secret-upstream-message");
  });
  it("handles rejected tokens as anonymous; authorization is not implemented here", async () => {
    mocks.claims.mockResolvedValue({ data: null, error: new AuthApiError("invalid token", 401, "bad_jwt") });
    expect((await updateSession(new NextRequest("https://inventory-test.invalid/dashboard"))).status).toBe(200);
  });
  it("fails closed with a sanitized, non-cacheable 503 on missing config", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const response = await updateSession(new NextRequest("https://inventory-test.invalid/dashboard"));
    expect(response.status).toBe(503);
    expect(mocks.server).not.toHaveBeenCalled();
    expect(await response.text()).toContain("Supabase 設定未完成");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not reflect exception details or leak tokens in responses", async () => {
    mocks.claims.mockRejectedValue(new Error("token=secret-token database=password"));
    const response = await updateSession(new NextRequest("https://inventory-test.invalid/dashboard"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/secret-token|database=password/);
  });
  it.each(["/", "/login", "/dashboard", "/items", "/moves/out", "/stocktake", "/api/moves", "/api/import/commit"])("covers %s, including Server Actions and APIs", (url) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
  });
  it.each(["/_next/static/chunk.js", "/_next/image?url=icon.png", "/favicon.ico", "/logo.svg"])("does not run Auth for static resource %s", (url) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
  });
});
