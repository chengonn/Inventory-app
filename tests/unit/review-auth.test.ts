import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}), createActionClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.verify }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.db }));
import { reviewQueue, previewReview, confirmReview } from "../../src/lib/review/service";
import { browseMoves } from "../../src/lib/moves/browse";
beforeEach(() => vi.resetAllMocks());
it.each(["anonymous", "forbidden", "unavailable"])("%s cannot read or mutate review or browse filtered moves", async (status) => {
  mocks.verify.mockResolvedValue({ status });
  for (const run of [() => reviewQueue({}), () => previewReview(new FormData()), () => confirmReview(new FormData()), () => browseMoves({})]) await expect(run()).rejects.toThrow("沒有交易權限");
  expect(mocks.db).not.toHaveBeenCalled();
});

it("rejects guest administrative operations before business DB access", async () => {
  mocks.verify.mockResolvedValue({status:"allowed", actor:{id:"visitor", email:"visitor@example.invalid", role:"guest"}});
  for (const run of [() => reviewQueue({}), () => previewReview(new FormData()), () => confirmReview(new FormData())]) await expect(run()).rejects.toThrow("管理者");
  expect(mocks.db).not.toHaveBeenCalled();
});
