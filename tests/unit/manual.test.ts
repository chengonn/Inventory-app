import { beforeEach, expect, it, vi } from "vitest";
import { parseManual } from "../../src/lib/manual/validation";
import { createManualInventory } from "../../src/lib/manual/transaction";
import type { Prisma } from "../../src/generated/prisma/client";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), lock: vi.fn(), pair: vi.fn(), masters: vi.fn() }));
vi.mock("../../src/lib/moves/transaction", () => ({ insertMove: mocks.insert, lockRequest: mocks.lock, lockStockPair: mocks.pair, masters: mocks.masters }));
const actor = { id: "owner", email: "owner@example.invalid" };
const values = { requestId: "00000000-0000-4000-8000-000000000001", name: "影印紙", unit: "包", area: "辦公室", cabinetNo: "A2", quantity: "2.500" };
function form(extra = {}) { const f = new FormData(); for (const [k, v] of Object.entries({ ...values, ...extra })) f.set(k, v); return f; }
function fixture() {
  const tx = { item: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 1 }) }, location: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 2, isActive: true }) }, openingInventory: { create: vi.fn().mockResolvedValue({ id: 3 }) }, auditLog: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() } };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
}
beforeEach(() => vi.resetAllMocks());
it.each([{ quantity: "-1" }, { quantity: "1e3" }, { quantity: "0.0001" }, { quantity: "9999999999999999" }, { unit: "" }, { requestId: "bad" }, { name: "a".repeat(201) }])("rejects invalid manual inputs: %j", (extra) => {
  expect(() => parseManual(form(extra))).toThrow();
});
it("creates masters, confirmed initial move and receipt in the caller's transaction", async () => {
  const { tx, client } = fixture();
  await createManualInventory(client, actor, parseManual(form()));
  expect(mocks.insert).toHaveBeenCalledWith(client, actor, expect.objectContaining({ itemId: 1, locationId: 2, normalizedQty: "2.500", type: "IN", status: "CONFIRMED" }));
  expect(tx.auditLog.create.mock.calls.map(([arg]) => arg.data.entityType)).toEqual(["Item", "Location", "ManualReceipt"]);
  expect(tx.openingInventory.create).not.toHaveBeenCalled();
});
it("records known zero with an opening and audit, without a zero move", async () => {
  const { tx, client } = fixture();
  await createManualInventory(client, actor, parseManual(form({ quantity: "0" })));
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.pair).toHaveBeenCalledWith(client, 1, 2);
  expect(tx.openingInventory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ normalizedQty: "0", status: "CONFIRMED" }) });
  expect(tx.auditLog.create.mock.calls.map(([arg]) => arg.data.entityType)).toContain("OpeningInventory");
});
it("replays the same actor/payload without new writes; changed payload or actor is rejected", async () => {
  const { tx, client } = fixture(), input = parseManual(form());
  await createManualInventory(client, actor, input);
  const receipt = tx.auditLog.create.mock.calls.at(-1)![0].data;
  tx.auditLog.findFirst.mockResolvedValue(receipt);
  tx.item.create.mockClear();
  expect(await createManualInventory(client, actor, input)).toEqual({ itemId: 1, replayed: true });
  expect(tx.item.create).not.toHaveBeenCalled();
  await expect(createManualInventory(client, actor, { ...input, quantity: "5.000" })).rejects.toThrow("其他資料");
  await expect(createManualInventory(client, { ...actor, id: "other" }, input)).rejects.toThrow("其他資料");
});
it("does not treat an existing item as a request to overwrite/add stock", async () => {
  const { tx, client } = fixture(); tx.item.findUnique.mockResolvedValue({ id: 4 });
  await expect(createManualInventory(client, actor, parseManual(form()))).rejects.toThrow("補貨請使用入庫");
  expect(tx.item.create).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
});
