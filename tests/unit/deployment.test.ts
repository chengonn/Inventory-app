import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}), createActionClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.auth }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.db }));
import { mutationsBlocked } from "../../src/lib/deployment";
import { commitMove, reverseMove } from "../../src/lib/moves/service";
import { saveMaster } from "../../src/lib/master-data/service";
import { confirmReview } from "../../src/lib/review/service";
import * as stocktake from "../../src/lib/stocktake/service";
import * as imports from "../../src/lib/imports/service";
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
it.each(["preview", "readonly"])("%s rejects business writes before database access", async (mode) => {
  vi.stubEnv("VERCEL_ENV", mode === "preview" ? "preview" : "production");
  vi.stubEnv("INVENTORY_READ_ONLY", mode === "readonly" ? "true" : "false");
  expect(mutationsBlocked()).toBe(true);
  for (const run of [() => commitMove("IN", new FormData()), () => reverseMove(new FormData()), () => saveMaster("items", new FormData()), () => confirmReview(new FormData()), () => stocktake.confirmStocktake(new FormData()), () => imports.previewImport(new FormData()), () => imports.confirmImport(new FormData())]) {
    await expect(run()).rejects.toThrow("僅供查詢");
  }
  expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.auth).not.toHaveBeenCalled();
});
it("production and local still require fresh authentication", async () => {
  vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("INVENTORY_READ_ONLY", "false");
  expect(mutationsBlocked()).toBe(false);
  mocks.auth.mockResolvedValue({ status: "anonymous" });
  await expect(commitMove("IN", new FormData())).rejects.toThrow("登入已失效");
  expect(mocks.db).not.toHaveBeenCalled();
});
