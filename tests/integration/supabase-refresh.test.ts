import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "../../src/lib/supabase/proxy";

// Actual installed SDK and NextRequest/NextResponse. Only HTTP transport is
// replaced, so no Supabase project, account, real password or network is used.
const origin = "https://inventory-test.invalid";
const storageName = "sb-inventory-test-auth-token";
const now = () => Math.floor(Date.now() / 1000);
const user = { email_confirmed_at: "2026-01-01T00:00:00Z", id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const jwt = (exp: number) => [
  { alg: "HS256", typ: "JWT" },
  { sub: user.id, aud: "authenticated", role: "authenticated", exp, iat: exp - 3600 },
].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".") + ".dGVzdC1zaWduYXR1cmU";
const session = (expired: boolean, padding = "") => ({
  access_token: jwt(expired ? now() - 60 : now() + 3600),
  refresh_token: expired ? "old-refresh-fixture" : "new-refresh-fixture",
  expires_at: expired ? now() - 60 : now() + 3600,
  expires_in: 3600, token_type: "bearer", user: { ...user, user_metadata: { padding } },
});
const requestWithSession = (padding = "") => new NextRequest(`${origin}/inventory`, {
  headers: { cookie: `${storageName}=base64-${Buffer.from(JSON.stringify(session(true, padding))).toString("base64url")}; unrelated=keep` },
});

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ALLOWED_USER_EMAIL", "fixture@example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", origin);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_local_test_only");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("installed Supabase SDK cookie refresh", () => {
  it("clears a verified non-allowed session and preserves cookie deletion on redirect", async () => {
    vi.stubEnv("ALLOWED_USER_EMAIL", "different@example.invalid");
    const fresh = session(false);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/token?grant_type=refresh_token")) return Response.json(fresh);
      if (url.endsWith("/user")) return Response.json(fresh.user);
      if (url.includes("/logout")) return new Response(null, { status: 204 });
      throw new Error("unexpected test URL");
    }));
    const response = await updateSession(requestWithSession());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/login?reason=forbidden`);
    expect(response.cookies.getAll().some((cookie) => cookie.name.startsWith(storageName) && cookie.value === "")).toBe(true);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not make an Auth request for anonymous traffic", async () => {
    const fetch = vi.fn(() => { throw new Error("unexpected network call"); });
    vi.stubGlobal("fetch", fetch);
    const response = await updateSession(new NextRequest(`${origin}/dashboard`));
    expect(response.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("refreshes an expired session and forwards SDK-generated chunks and cache headers", async () => {
    const fresh = session(false, "x".repeat(4200));
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `${origin}/auth/v1/token?grant_type=refresh_token`) {
        expect(JSON.parse(String(init?.body)).refresh_token).toBe("old-refresh-fixture");
        return Response.json(fresh);
      }
      if (url === `${origin}/auth/v1/user`) return Response.json(fresh.user);
      throw new Error("unexpected test URL");
    });
    vi.stubGlobal("fetch", fetch);
    const request = requestWithSession();
    const response = await updateSession(request);
    expect(response.status).toBe(200);
    const chunks = response.cookies.getAll().filter((cookie) => cookie.name.startsWith(`${storageName}.`) && cookie.maxAge !== 0).sort((a, b) => a.name.localeCompare(b.name));
    expect(chunks.length).toBeGreaterThan(1);
    const encoded = chunks.map(({ value }) => value).join("");
    const stored = JSON.parse(Buffer.from(encoded.replace(/^base64-/, ""), "base64url").toString());
    expect(stored.refresh_token).toBe("new-refresh-fixture");
    expect(stored.access_token).toBe(fresh.access_token);
    expect(response.cookies.get(storageName)?.maxAge).toBe(0);
    chunks.forEach((cookie) => {
      expect(cookie.secure).toBe(true);
      expect(cookie.sameSite).toBe("lax");
      expect(cookie.path).toBe("/");
      expect(cookie.domain).toBeUndefined();
      expect(request.cookies.get(cookie.name)?.value).toBe(cookie.value);
    });
    expect(request.cookies.get("unrelated")?.value).toBe("keep");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
    expect(fetch).toHaveBeenCalledTimes(3); // refresh, claims validation, fresh authorization
  });
  it("clears a rejected refresh token and keeps unrelated cookies", async () => {
    const fetch = vi.fn(async () => Response.json({ code: "refresh_token_not_found", message: "Invalid Refresh Token" }, { status: 400 }));
    vi.stubGlobal("fetch", fetch);
    const request = requestWithSession();
    const response = await updateSession(request);
    expect(response.status).toBe(200);
    expect(response.cookies.get(storageName)?.maxAge).toBe(0);
    expect(response.cookies.get(storageName)?.value).toBe("");
    expect(request.cookies.get("unrelated")?.value).toBe("keep");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
