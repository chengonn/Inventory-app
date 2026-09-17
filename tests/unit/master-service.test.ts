import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), prisma: vi.fn(), transaction: vi.fn(), create: vi.fn(), update: vi.fn(), find: vi.fn(), audit: vi.fn(), list: vi.fn() }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.verify }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}), createActionClient: async () => ({}) }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.prisma }));
import { listMasters, saveMaster } from "../../src/lib/master-data/service";
const row = { id: 1, name: "紙箱", unit: null, safetyStock: null, note: null, isActive: true, updatedAt: new Date("2026-09-08T00:00:00Z") };
const model = { create: mocks.create, updateMany: mocks.update, findUnique: mocks.find, findUniqueOrThrow: mocks.find, findMany: mocks.list };
beforeEach(() => {
  vi.resetAllMocks(); mocks.verify.mockResolvedValue({ status: "allowed", actor: { id: "verified", email: "verified@example.com" } });
  mocks.prisma.mockReturnValue({ $transaction: mocks.transaction, item: model, location: model });
  mocks.transaction.mockImplementation(async (fn) => fn({ item: model, location: model, auditLog: { create: mocks.audit } }));
  mocks.create.mockResolvedValue(row); mocks.find.mockResolvedValue(row); mocks.update.mockResolvedValue({ count: 1 }); mocks.audit.mockResolvedValue({}); mocks.list.mockResolvedValue([row]);
});
function form(edit = false) { const f = new FormData(); f.set("name", "紙箱"); f.set("isActive", "true"); f.set("actorEmail", "forged@example.com"); if (edit) { f.set("id", "1"); f.set("version", row.updatedAt.toISOString()); } return f; }
it("rejects unauthenticated reads and writes before acquiring DB", async () => {
  mocks.verify.mockResolvedValue({ status: "anonymous" });
  await expect(saveMaster("items", form())).rejects.toThrow("沒有操作權限");
  await expect(listMasters("items", "", "active", 1)).rejects.toThrow();
  expect(mocks.prisma).not.toHaveBeenCalled();
});
it("creates within the same transaction as the audit, using verified actor", async () => {
  await saveMaster("items", form());
  expect(mocks.transaction).toHaveBeenCalledOnce();
  expect(mocks.audit.mock.calls[0][0].data.actorEmail).toBe("verified@example.com");
  expect(mocks.audit.mock.calls[0][0].data.entityId).toBe("1");
});
it("rejects stale versions without emitting an audit", async () => {
  mocks.update.mockResolvedValue({ count: 0 });
  await expect(saveMaster("items", form(true))).rejects.toThrow("資料已被更新");
  expect(mocks.audit).not.toHaveBeenCalled();
  expect(mocks.update.mock.calls[0][0].where).toEqual({ id: 1, updatedAt: row.updatedAt });
});
it("propagates audit failure so transaction cannot commit", async () => {
  mocks.audit.mockRejectedValue(new Error("private database details"));
  await expect(saveMaster("items", form())).rejects.toThrow("儲存失敗");
});
it("deactivation is an update that retains record ID", async () => {
  const f = form(true); f.set("isActive", "false"); await saveMaster("items", f);
  expect(mocks.update.mock.calls[0][0].data.isActive).toBe(false);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("defaults read results to active, paginates and serializes dates", async () => {
  const result = await listMasters("items", " 紙 ", "active", 2);
  expect(mocks.list.mock.calls[0][0]).toMatchObject({ where: { isActive: true }, skip: 50, take: 51 });
  expect(result.rows[0].version).toBe(row.updatedAt.toISOString());
});
