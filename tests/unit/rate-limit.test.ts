import { beforeEach, expect, it, vi } from "vitest";
vi.unmock("@/lib/security/rate-limit");
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), query: vi.fn(), execute: vi.fn() }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: () => ({ $transaction: mocks.transaction }) }));
import { enforceRateLimit, RateLimitError } from "../../src/lib/security/rate-limit";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (run) => run({ $executeRaw: mocks.execute, $queryRaw: mocks.query }));
});
it("commits a rejected attempt before returning a rate-limit error", async () => {
  mocks.query.mockResolvedValue([{ allowed: false }]);
  await expect(enforceRateLimit("login")).rejects.toBeInstanceOf(RateLimitError);
  await expect(mocks.transaction.mock.results[0].value).resolves.toEqual([{ allowed: false }]);
});
it("fails closed when database is unavailable or returns no decision", async () => {
  mocks.query.mockRejectedValueOnce(new Error("DB unavailable"));
  await expect(enforceRateLimit("write")).rejects.toThrow();
  mocks.query.mockResolvedValue([]);
  await expect(enforceRateLimit("export")).rejects.toThrow();
});
