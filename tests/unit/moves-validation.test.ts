import { expect, it } from "vitest";
import { parseMove, parseReversal } from "../../src/lib/moves/validation";
const form = (overrides: Record<string, string | undefined> = {}) => { const f = new FormData(); for (const [k, v] of Object.entries({ requestId: crypto.randomUUID(), itemId: "1", locationId: "2", mode: "direct", quantity: "0.125", ...overrides })) if (v !== undefined) f.set(k, v); return f; };
it("derives sign/status server-side, ignoring forged client fields", () => {
  expect(parseMove("OUT", form({ signedQty: "100", status: "IGNORED" }))).toMatchObject({ normalizedQty: "0.125", signedQty: "-0.125", status: "CONFIRMED" });
});
it.each(["0", "-1", "NaN", "Infinity", "1e3", "1.0001", "1000000000000000", "", "1,000"])("rejects unsafe quantity %s", (quantity) => expect(() => parseMove("IN", form({ quantity }))).toThrow());
it("preserves maximum decimal without floating point rounding", () => expect(parseMove("IN", form({ quantity: "999999999999999.999" })).normalizedQty).toBe("999999999999999.999"));
it("converts containers exactly", () => expect(parseMove("IN", form({ mode: "container", containerType: "箱", containerCount: "2.5", unitsPerContainer: "3.2", looseQty: "0.001" })).normalizedQty).toBe("8.001"));
it("unknown containers are review-only and cannot be OUT", () => {
  const f = form({ mode: "container", containerType: "盒", containerCount: "2", looseQty: "1" });
  expect(parseMove("IN", f)).toMatchObject({ status: "NEEDS_REVIEW", normalizedQty: null, signedQty: null });
  expect(() => parseMove("OUT", f)).toThrow("未知");
});
it.each([{ containerCount: "0.001", unitsPerContainer: "0.001" }, { containerCount: "999999999999999", unitsPerContainer: "2" }, { containerCount: "0", unitsPerContainer: "1" }])("rejects rounded/overflow/empty conversion %j", (extra) => expect(() => parseMove("IN", form({ mode: "container", containerType: "箱", ...extra }))).toThrow());
it.each([{ itemId: "0" }, { locationId: "2147483648" }, { requestId: "forged" }, { mode: "unknown" }, { note: "x".repeat(2001) }])("rejects invalid payload %j", (extra) => expect(() => parseMove("IN", form(extra))).toThrow());
it("rejects unexpected move type and missing reversal reason", () => {
  expect(() => parseMove("ADJUST_LOSS", form())).toThrow();
  expect(() => parseReversal(form({ originalId: "1", note: " " }))).toThrow();
  expect(parseReversal(form({ originalId: "1", note: " 誤登 " })).note).toBe("誤登");
});
