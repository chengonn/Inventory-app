import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adapter: vi.fn(function (options: unknown, settings: unknown) { return { options, settings }; }),
  client: vi.fn(function (options: unknown) { return { options }; }),
}));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: mocks.adapter }));
vi.mock("../../src/generated/prisma/client", () => ({ PrismaClient: mocks.client }));
import { getPrisma } from "../../src/lib/prisma";

const state = globalThis as unknown as { inventoryPrisma?: unknown };
beforeEach(() => { delete state.inventoryPrisma; vi.clearAllMocks(); });
afterEach(() => { delete state.inventoryPrisma; vi.unstubAllEnvs(); });

it("constructs one lazy runtime client using only DATABASE_URL, never DIRECT_URL", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://postgres.testref:fixture@aws-0-test.pooler.supabase.com:6543/postgres");
  vi.stubEnv("DIRECT_URL", "must-not-be-used-at-runtime");
  expect(getPrisma()).toBe(getPrisma());
  expect(mocks.client).toHaveBeenCalledTimes(1);
  expect(mocks.adapter).toHaveBeenCalledTimes(1);
  const settings = mocks.adapter.mock.calls[0][1];
  expect(settings).toMatchObject({ schema: "inventory" });
  expect(settings).not.toHaveProperty("statementNameGenerator");
  expect(mocks.client.mock.calls[0][0]).toMatchObject({ errorFormat: "minimal", log: [] });
});

it("fails before creating an adapter when runtime credentials are missing", () => {
  vi.stubEnv("DATABASE_URL", "");
  expect(getPrisma).toThrow("DATABASE_URL");
  expect(mocks.adapter).not.toHaveBeenCalled();
});
