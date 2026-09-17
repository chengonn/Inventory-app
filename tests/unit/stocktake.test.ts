import { expect, it, vi, beforeEach } from "vitest";
import { parseStocktake, stocktakeDelta } from "../../src/lib/stocktake/validation";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({}), createActionClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: mocks.verify }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: mocks.db }));
import { loadCountSheet, previewStocktake, confirmStocktake } from "../../src/lib/stocktake/service";
const form = (fields: Record<string, string> = {}) => { const f = new FormData(); for (const [k, v] of Object.entries({ requestId: crypto.randomUUID(), locationId: "1", "actual-2": "0", ...fields })) f.set(k, v); return f; };
beforeEach(() => vi.resetAllMocks());
it("blank is uncounted, zero is counted, and IDs are sorted", () => {
  expect(parseStocktake(form({ "actual-8": "", "actual-1": "1.125" })).lines).toEqual([{ itemId: 1, actual: "1.125" }, { itemId: 2, actual: "0.000" }]);
});
it.each(["-1", "NaN", "Infinity", "1e3", "0.0001", "1000000000000000", "abc"])("rejects unsafe actual %s", (value) => expect(() => parseStocktake(form({ "actual-2": value }))).toThrow());
it("rejects duplicate items, empty sheets, >50 lines and invalid IDs", () => {
  const duplicate = form(); duplicate.append("actual-2", "4"); expect(() => parseStocktake(duplicate)).toThrow("重複");
  expect(() => parseStocktake(form({ "actual-2": " " }))).toThrow("1 至 50");
  expect(() => parseStocktake(form(Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`actual-${i + 1}`, "0"]))))).toThrow("1 至 50");
  expect(() => parseStocktake(form({ "actual-2147483648": "1" }))).toThrow();
  expect(() => parseStocktake(form({ locationId: "0" }))).toThrow();
  expect(() => parseStocktake(form({ requestId: "fake" }))).toThrow();
});
it("ignores forged delta and actor and keeps decimal precision", () => {
  expect(parseStocktake(form({ "actual-2": "999999999999999.999", signedQty: "-9", actorEmail: "fake@example.com" })).lines[0].actual).toBe("999999999999999.999");
  expect(stocktakeDelta("999999999999999.999", "999999999999999.998")).toMatchObject({ signedQty: "0.001", type: "ADJUST_GAIN" });
  expect(stocktakeDelta("0.000", "1.125")).toMatchObject({ signedQty: "-1.125", type: "ADJUST_LOSS" });
  expect(stocktakeDelta("1.000", "1.000").type).toBeNull();
  expect(() => stocktakeDelta("0.000", "1000000000000000.000")).toThrow("精度上限");
});
it.each(["anonymous", "forbidden", "unavailable"])("all stocktake entry points reject %s before DB access", async (status) => {
  mocks.verify.mockResolvedValue({ status });
  for (const run of [() => loadCountSheet(1), () => previewStocktake(form()), () => confirmStocktake(form())]) await expect(run()).rejects.toThrow("沒有交易權限");
  expect(mocks.db).not.toHaveBeenCalled();
});
it("rejects invalid submission before transaction", async () => {
  mocks.verify.mockResolvedValue({ status: "allowed", actor: { id: "owner", email: "owner@example.com" } });
  await expect(confirmStocktake(form({ "actual-2": "-1" }))).rejects.toThrow();
  expect(mocks.db).not.toHaveBeenCalled();
});
