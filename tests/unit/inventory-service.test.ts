import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mock.verify }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mock.db }));
import { Prisma } from "../../src/generated/prisma/client";
import { calculateStock } from "../../src/lib/inventory/service";
import { inventoryId, readLocationStock } from "../../src/lib/inventory/query";
beforeEach(() => { vi.resetAllMocks(); mock.verify.mockResolvedValue({ status: "allowed" }); mock.db.mockReturnValue({ $queryRaw: mock.query }); mock.query.mockResolvedValue([]); });
it.each(["anonymous", "forbidden", "unavailable"])("rejects %s before reading DB", async (status) => {
  mock.verify.mockResolvedValue({ status }); await expect(calculateStock()).rejects.toThrow("沒有庫存查詢權限"); expect(mock.db).not.toHaveBeenCalled();
});
it.each([0, -1, NaN, Infinity, 1.1, 2147483648])("rejects invalid ID %s", (id) => expect(() => inventoryId(id)).toThrow());
it("returns an empty result without inventing physical zero stock", async () => {
  expect(await calculateStock()).toEqual({ locations: [], items: [] });
});
it("preserves decimals beyond JS safe integer and does not double-count item totals", async () => {
  const d = (v: string) => new Prisma.Decimal(v);
  mock.query.mockResolvedValue([1, 2].map((locationId) => ({ itemId: 1, locationId, openingQty: d("9007199254740993.001"), movementQty: d("-0.001"), currentQty: d("9007199254740993.000"), itemTotalQty: d("18014398509481986.000") })));
  const result = await calculateStock(1);
  expect(result.items).toEqual([{ itemId: 1, currentQty: "18014398509481986.000" }]);
  expect(result.locations[0].currentQty).toBe("9007199254740993.000");
  expect(mock.query).toHaveBeenCalledOnce();
});
it("transaction helper uses the supplied transaction and returns decimal zero for no confirmed ledger", async () => {
  const tx = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as Prisma.TransactionClient;
  expect((await readLocationStock(tx, 1, 2)).toFixed(3)).toBe("0.000");
  expect(mock.db).not.toHaveBeenCalled();
});
