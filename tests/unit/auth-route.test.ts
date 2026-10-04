import { afterEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), signOut: vi.fn() }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.verify }));
vi.mock("../../src/lib/supabase/route-handler", () => ({
  createRouteClient: (_request: NextRequest, response: NextResponse) => {
    response.cookies.set("refreshed", "fixture", { sameSite: "lax", secure: true });
    return { auth: { signOut: mocks.signOut } };
  },
}));
import { GET } from "../../src/app/api/auth/session/route";
afterEach(() => vi.resetAllMocks());
it.each([["anonymous", 401], ["forbidden", 403], ["unavailable", 503], ["allowed", 204]])("returns %s with safe HTTP status", async (status, code) => {
  mocks.verify.mockResolvedValue({ status });
  mocks.signOut.mockResolvedValue({ error: null });
  const result = await GET(new NextRequest("https://app.invalid/api/auth/session"));
  expect(result.status).toBe(code);
  expect(result.cookies.get("refreshed")?.value).toBe("fixture");
  expect(result.headers.get("cache-control")).toContain("no-store");
  expect(await result.text()).toBe("");
  if (status === "forbidden") expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
});
