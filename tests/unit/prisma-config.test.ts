import { afterEach, expect, it, vi } from "vitest";

vi.mock("@next/env", () => ({ default: { loadEnvConfig: vi.fn() } }));
afterEach(() => vi.unstubAllEnvs());

it("Prisma CLI reads only DIRECT_URL, not the runtime pooler", async () => {
  vi.resetModules();
  const direct = "postgresql://postgres:fixture@db.testref.supabase.co:5432/postgres?sslmode=require&schema=inventory";
  vi.stubEnv("DIRECT_URL", direct);
  vi.stubEnv("DATABASE_URL", "wrong-runtime-url-must-not-be-used");
  const { default: config } = await import("../../prisma.config");
  expect(config.datasource?.url).toBe(direct);
  expect(config.schema).toBe("prisma/schema.prisma");
});

it("offline CLI config never invents a fallback URL", async () => {
  vi.resetModules();
  vi.stubEnv("DIRECT_URL", "");
  vi.stubEnv("DATABASE_URL", "postgresql://private-runtime-fixture");
  const { default: config } = await import("../../prisma.config");
  expect(config.datasource?.url).toBeUndefined();
});
