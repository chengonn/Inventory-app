import { expect, it } from "vitest";
import { parseReview } from "../../src/lib/review/validation";
const form = (extra: Record<string, string | undefined> = {}) => { const data = new FormData(); for (const [k, v] of Object.entries({ entity: "OpeningInventory", id: "1", requestId: crypto.randomUUID(), decision: "CONFIRM", mode: "direct", quantity: "2.125", unit: "個", reason: "核對實物", ...extra })) if (v !== undefined) data.set(k, v); return data; };
it("review parses exact direct/container quantities and explicit zero opening", () => {
  expect(parseReview(form()).normalizedQty).toBe("2.125");
  expect(parseReview(form({ quantity: "0" })).normalizedQty).toBe("0.000");
  expect(parseReview(form({ mode: "container", containerType: "組", containerCount: "3", unitsPerContainer: "6", looseQty: "4" })).normalizedQty).toBe("22.000");
});
it("ignored rows do not accept client quantities or units into the decision", () => {
  expect(parseReview(form({ decision: "IGNORE", quantity: "999", unit: "secret" }))).toMatchObject({ normalizedQty: null, unit: null, decision: "IGNORE" });
});
it.each([{ entity: "Item" }, { id: "-1" }, { requestId: "bad" }, { reason: "" }, { decision: "DELETE" }, { unit: "未註明" }, { entity: "StockMove", quantity: "0" }, { quantity: "-1" }, { quantity: "0.0001" }, { quantity: "1000000000000000" }, { mode: "container", containerType: "盒", containerCount: "2" }, { mode: "container", containerType: "盒", containerCount: "0.001", unitsPerContainer: "0.001" }])("invalid review is rejected: %j", (extra) => { expect(() => parseReview(form(extra))).toThrow(); });
