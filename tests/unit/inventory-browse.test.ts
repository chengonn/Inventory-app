import { expect, it, vi, beforeEach } from "vitest";
import { inventoryRows, filterInventory, searchOptions, taipeiDay } from "../../src/lib/inventory/read-model";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}), createActionClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.verify }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.db }));
import { browseInventory, dashboardData } from "../../src/lib/inventory/browse";
beforeEach(() => vi.resetAllMocks());
const item = { id: 1, name: "膠帶 Tape", unit: "個", isActive: false, safetyStock: "10.000" };
const locations = [{ id: 1, area: "A區", cabinetNo: "櫃01", isActive: true }, { id: 2, area: "B區", cabinetNo: "櫃02", isActive: false }];
const stock = [1, 2].map((locationId) => ({ itemId: 1, locationId, openingQty: "5.000", movementQty: "0.000", currentQty: "5.000", itemTotalQty: "10.000" }));
it("low stock uses strict total comparison, retains inactive history, and does not shrink with location search", () => {
  const rows = inventoryRows([item], locations, stock, []);
  expect(rows[0]).toMatchObject({ low: false, current: "10.000", isActive: false, hasStock: true });
  const found = filterInventory(rows, searchOptions({ q: "櫃02" })).rows[0];
  expect(found.pairs).toHaveLength(1); expect(found.current).toBe("10.000"); expect(found.low).toBe(false);
  expect(found.pairs[0].isActive).toBe(false);
});
it("unset safety is not low; unknown-only and no-history do not invent confirmed pairs", () => {
  const rows = inventoryRows([{ ...item, safetyStock: null }, { ...item, id: 2 }], locations, [], [{ itemId: 1, locationId: 2 }]);
  expect(rows.find((r) => r.id === 1)).toMatchObject({ low: false, hasConfirmed: false, hasStock: false, review: 1, current: "0.000" });
  expect(rows.find((r) => r.id === 1)?.pairs[0]).toMatchObject({ hasConfirmed: false, review: 1 });
  expect(rows.find((r) => r.id === 2)).toMatchObject({ low: true, pairs: [], hasConfirmed: false });
});
it("compares decimal thresholds exactly and retains negative balance", () => {
  expect(inventoryRows([{ ...item, safetyStock: "999999999999999.999" }], locations, [{ ...stock[0], currentQty: "999999999999999.998", itemTotalQty: "999999999999999.998" }], [])[0].low).toBe(true);
  expect(inventoryRows([{ ...item, safetyStock: "0.000" }], locations, [{ ...stock[0], currentQty: "-0.001", itemTotalQty: "-0.001" }], [])[0]).toMatchObject({ low: true, hasStock: false, current: "-0.001" });
});
it.each(["tape", "膠帶", "A區", "櫃02"])("searches literal name/area/cabinet %s", (q) => expect(filterInventory(inventoryRows([item], locations, stock, []), searchOptions({ q })).total).toBe(1));
it("SQL wildcard and injection-looking input are literal search terms", () => {
  const rows = inventoryRows([item], locations, stock, []);
  for (const q of ["%", "_", "' OR 1=1 --"]) expect(filterInventory(rows, searchOptions({ q })).total).toBe(0);
});
it("filters before pagination, clamps page, and counts items rather than locations", () => {
  const rows = inventoryRows(Array.from({ length: 41 }, (_, i) => ({ ...item, id: i + 1, name: `Item${String(i).padStart(2, "0")}` })), [], [], []);
  const result = filterInventory(rows, searchOptions({ page: "999", low: "1" }));
  expect(result).toMatchObject({ total: 41, pages: 3, page: 3 }); expect(result.rows).toHaveLength(1);
  expect(filterInventory(rows, searchOptions({ q: "nomatch" }))).toMatchObject({ total: 0, page: 1, pages: 1, rows: [] });
});
it("bounds untrusted URL parameters", () => {
  expect(searchOptions({ q: ["foo", "bar"], page: "-1", low: "true" })).toEqual({ q: "", page: 1, low: false });
  expect(searchOptions({ q: "x".repeat(101), page: "1e6" }).q).toHaveLength(100);
});
it.each(["2026-09-17T16:00:00.000Z", "2026-09-18T15:59:59.999Z"])("uses Taipei midnight bounds for %s", (now) => {
  const day = taipeiDay(new Date(now)); expect(day.start.toISOString()).toBe("2026-09-17T16:00:00.000Z"); expect(day.end.toISOString()).toBe("2026-09-18T16:00:00.000Z");
});
it.each(["anonymous", "forbidden", "unavailable"])("denies both read endpoints for %s before DB access", async (status) => {
  mocks.verify.mockResolvedValue({ status });
  await expect(dashboardData()).rejects.toThrow("沒有交易權限"); await expect(browseInventory({})).rejects.toThrow("沒有交易權限");
  expect(mocks.db).not.toHaveBeenCalled();
});
