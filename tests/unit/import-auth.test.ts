import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}), createActionClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.verify }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.db }));
import { previewImport, confirmImport, importHistory } from "../../src/lib/imports/service";
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllEnvs());
it.each(["anonymous", "forbidden", "unavailable"])("%s cannot parse, preview, commit or read history", async (status) => {
  mocks.verify.mockResolvedValue({ status });
  for (const run of [() => previewImport(new FormData()), () => confirmImport(new FormData()), importHistory]) await expect(run()).rejects.toThrow("沒有交易權限");
  expect(mocks.db).not.toHaveBeenCalled();
});
it("authenticated callers still need a file or a valid preview token and checkbox", async () => {
  vi.stubEnv("ENABLE_LEGACY_EXCEL_IMPORT", "true");
  mocks.verify.mockResolvedValue({ status: "allowed", actor: { id: "test", email: "test@example.invalid" } });
  await expect(previewImport(new FormData())).rejects.toThrow(".xlsx");
  const form = new FormData(); form.set("token", crypto.randomUUID());
  await expect(confirmImport(form)).rejects.toThrow("勾選");
  expect(mocks.db).not.toHaveBeenCalled();
});
it("manual mode denies both import stages before any database or workbook access", async () => {
  vi.stubEnv("ENABLE_LEGACY_EXCEL_IMPORT", "false");
  mocks.verify.mockResolvedValue({ status: "allowed", actor: { id: "test", email: "test@example.invalid" } });
  for (const run of [previewImport, confirmImport]) await expect(run(new FormData())).rejects.toThrow("Excel 匯入已停用");
  expect(mocks.db).not.toHaveBeenCalled();
});
