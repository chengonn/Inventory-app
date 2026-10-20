import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}), createActionClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.verify }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.db }));
import { commitMove, previewMove, reverseMove, moveOptions, recentMoves } from "../../src/lib/moves/service";
beforeEach(() => vi.resetAllMocks());
it.each(["anonymous", "forbidden", "unavailable"])("all move entry points reject %s before DB access", async (status) => {
  mocks.verify.mockResolvedValue({ status });
  for (const run of [() => commitMove("IN", new FormData()), () => previewMove("OUT", new FormData()), () => reverseMove(new FormData()), moveOptions, recentMoves]) await expect(run()).rejects.toThrow("沒有交易權限");
  expect(mocks.db).not.toHaveBeenCalled();
});
it("validates before opening transaction and uses fresh verified actor", async () => {
  mocks.verify.mockResolvedValue({ status: "allowed", actor: { id: "owner", email: "owner@example.com" } });
  await expect(commitMove("IN", new FormData())).rejects.toThrow();
  expect(mocks.db).not.toHaveBeenCalled();
});

it("rejects guest administrative operations before business DB access", async () => {
  mocks.verify.mockResolvedValue({status:"allowed", actor:{id:"visitor", email:"visitor@example.invalid", role:"guest"}});
  await expect(reverseMove(new FormData())).rejects.toThrow("管理者");
  expect(mocks.db).not.toHaveBeenCalled();
});
