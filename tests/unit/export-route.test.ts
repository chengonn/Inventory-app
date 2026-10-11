import { afterEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), signOut: vi.fn(), db: vi.fn(), read: vi.fn() }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.verify }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.db }));
vi.mock("../../src/lib/exports/data", () => ({ readExport: mocks.read }));
vi.mock("../../src/lib/supabase/route-handler", () => ({ createRouteClient: (_request: NextRequest, response: NextResponse) => { response.cookies.set("refreshed", "fixture", { sameSite: "lax", secure: true }); return { auth: { signOut: mocks.signOut } }; } }));
import { GET } from "../../src/app/api/export/route";
import { enforceRateLimit, RateLimitError } from "../../src/lib/security/rate-limit";
afterEach(() => vi.resetAllMocks());
it("returns 429 and Retry-After without exporting when the quota is exhausted", async () => {
  mocks.verify.mockResolvedValue({ status: "allowed" });
  vi.mocked(enforceRateLimit).mockRejectedValueOnce(new RateLimitError("操作次數過多"));
  const response = await GET(new NextRequest("https://app.invalid/api/export"));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(response.cookies.get("refreshed")?.value).toBe("fixture");
  expect(mocks.db).not.toHaveBeenCalled();
});
it.each([["anonymous", 401], ["forbidden", 403], ["unavailable", 503]])("%s export is blocked before DB", async (status, code) => {
  mocks.verify.mockResolvedValue({ status }); const response = await GET(new NextRequest("https://app.invalid/api/export?kind=backup"));
  expect(response.status).toBe(code); expect(response.cookies.get("refreshed")?.value).toBe("fixture"); expect(response.headers.get("cache-control")).toContain("no-store"); expect(mocks.db).not.toHaveBeenCalled();
});
it("authorized download retains refreshed cookies, no-store and safe headers", async () => {
  mocks.verify.mockResolvedValue({ status: "allowed", actor: { id: "owner", email: "owner@example.invalid" } });
  mocks.db.mockReturnValue({ $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ $executeRaw: vi.fn() }) });
  mocks.read.mockResolvedValue([{ name: "Items", headers: ["name"], rows: [["=evil()"]] }]);
  const response = await GET(new NextRequest("https://app.invalid/api/export?kind=backup"));
  expect(response.status).toBe(200); expect(response.cookies.get("refreshed")?.value).toBe("fixture"); expect(response.headers.get("content-type")).toContain("spreadsheetml"); expect(response.headers.get("content-disposition")).toContain("attachment"); expect(response.headers.get("cache-control")).toContain("no-store");
});
it("raw database errors and secrets never appear in an export error", async () => {
  mocks.verify.mockResolvedValue({ status: "allowed" }); mocks.db.mockImplementation(() => { throw new Error("postgres://password@private"); });
  const response = await GET(new NextRequest("https://app.invalid/api/export")); expect(response.status).toBe(503); expect(await response.text()).not.toContain("password");
});
