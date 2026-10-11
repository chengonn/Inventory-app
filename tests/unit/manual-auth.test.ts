import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}), createActionClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.auth }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.db }));
import { saveManualInventory } from "../../src/lib/manual/service";
beforeEach(() => vi.resetAllMocks());
it.each(["anonymous", "forbidden", "unavailable"])("manual write rejects %s before business DB access", async (status) => {
  mocks.auth.mockResolvedValue({ status });
  await expect(saveManualInventory(new FormData())).rejects.toThrow("沒有交易權限");
  expect(mocks.db).not.toHaveBeenCalled();
});
