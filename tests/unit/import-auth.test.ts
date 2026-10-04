import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}), createActionClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.verify }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.db }));
import { previewImport, confirmImport, importHistory } from "../../src/lib/imports/service";
beforeEach(() => vi.resetAllMocks());
it.each(["anonymous", "forbidden", "unavailable"])("%s cannot parse, preview, commit or read history", async (status) => {
  mocks.verify.mockResolvedValue({ status });
  for (const run of [() => previewImport(new FormData()), () => confirmImport(new FormData()), importHistory]) await expect(run()).rejects.toThrow("沒有交易權限");
  expect(mocks.db).not.toHaveBeenCalled();
});
it("authenticated callers still need a file or a valid preview token and checkbox", async () => {
  mocks.verify.mockResolvedValue({ status: "allowed", actor: { id: "test", email: "test@example.invalid" } });
  await expect(previewImport(new FormData())).rejects.toThrow(".xlsx");
  const form = new FormData(); form.set("token", crypto.randomUUID());
  await expect(confirmImport(form)).rejects.toThrow("勾選");
  expect(mocks.db).not.toHaveBeenCalled();
});
