import { expect, it } from "vitest";
import { parseMaster, parseIdentity, masterKind } from "../../src/lib/master-data/validation";
const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };
it("trims text and keeps blank safety stock unknown rather than zero", () => {
  expect(parseMaster("items", form({ name: "  紙箱  ", isActive: "true" }))).toEqual({ name: "紙箱", unit: null, safetyStock: null, note: null, isActive: true });
});
it.each(["-1", "NaN", "Infinity", "1e3", "0.0001", "1000000000000000", "1,000"])("rejects invalid decimal %s", (safetyStock) => {
  expect(() => parseMaster("items", form({ name: "紙箱", isActive: "true", safetyStock }))).toThrow();
});
it.each(["0", "0.001", "999999999999999.999"])("preserves exact decimal %s", (safetyStock) => {
  expect(parseMaster("items", form({ name: "紙箱", isActive: "true", safetyStock }))).toHaveProperty("safetyStock", safetyStock);
});
it("requires both location identifiers", () => {
  expect(() => parseMaster("locations", form({ area: "A", cabinetNo: " ", isActive: "false" }))).toThrow();
});
it("does not treat string false as active", () => {
  expect(parseMaster("locations", form({ area: " A ", cabinetNo: "01", isActive: "false" }))).toHaveProperty("isActive", false);
});
it("rejects unsupported types, malformed IDs and missing versions", () => {
  expect(() => masterKind("users")).toThrow();
  expect(() => parseIdentity(form({ id: "1 OR 1=1" }))).toThrow();
  expect(() => parseIdentity(form({ id: "1" }))).toThrow();
});
it("rejects missing active flags and overlong names", () => {
  expect(() => parseMaster("items", form({ name: "x" }))).toThrow();
  expect(() => parseMaster("items", form({ name: "x".repeat(201), isActive: "true" }))).toThrow();
});
