import { expect, it } from "vitest";
import * as XLSX from "xlsx";
import { exportWorkbook, jsonChunks } from "../../src/lib/exports/workbook";
import { moveFilters, moveFilterQuery } from "../../src/lib/moves/filter";
it("xlsx preserves Decimal strings and formula-looking text without formulas or links", () => {
  const values = ["999999999999999.999", "-0.001", '=HYPERLINK("https://example.invalid")', "+1+1", "@SUM(A1)", "00123"];
  const sheet = XLSX.read(exportWorkbook([{ name: "Test", headers: ["value"], rows: values.map((r) => [r]) }]), { type: "buffer", cellFormula: true }).Sheets.Test;
  values.forEach((value, i) => { expect(sheet[`A${i + 2}`]).toMatchObject({ t: "s", v: value }); expect(sheet[`A${i + 2}`].f).toBeUndefined(); expect(sheet[`A${i + 2}`].l).toBeUndefined(); });
});
it("JSON chunks round trip long unicode without splitting surrogate pairs", () => {
  const value = { text: "測試😀".repeat(17000) }, chunks = jsonChunks(value);
  expect(chunks.length).toBeGreaterThan(1); expect(chunks.every((c) => c.length <= 32000)).toBe(true);
  const sheet = XLSX.read(exportWorkbook([{ name: "Json", headers: ["chunk"], rows: chunks.map((c) => [c]) }]), { type: "buffer" }).Sheets.Json;
  const joined = chunks.map((_, i) => sheet[`A${i + 2}`].v).join(""); expect(JSON.parse(joined)).toEqual(value);
});
it("empty exports retain headers, oversized exports reject rather than truncate", () => {
  const book = XLSX.read(exportWorkbook([{ name: "Empty", headers: ["id", "name"], rows: [] }]), { type: "buffer" }); expect(book.Sheets.Empty.B1.v).toBe("name");
  expect(() => exportWorkbook([{ name: "Limit", headers: ["x"], rows: Array.from({ length: 10001 }, () => [1]) }])).toThrow("10000");
  expect(() => exportWorkbook([{ name: "Limit", headers: ["x"], rows: [["x".repeat(32768)]] }])).toThrow("欄位");
});
it("move filters use inclusive Taipei dates, preserve query and exclude pagination", () => {
  const result = moveFilters({ q: "筆", type: "OUT", status: "CONFIRMED", from: "2026-09-01", to: "2026-09-01", page: "9" });
  expect(result.where.occurredAt).toEqual({ gte: new Date("2026-08-31T16:00:00Z"), lt: new Date("2026-09-01T16:00:00Z") });
  const params = new URLSearchParams(moveFilterQuery(result)); expect(params.get("q")).toBe("筆"); expect(params.has("page")).toBe(false);
});
it.each([{ from: "2026-02-30" }, { from: "2026-09-02", to: "2026-09-01" }, { type: "DELETE" }, { status: "ALL" }, { to: "yesterday" }])("invalid export filters are rejected %j", (params) => { expect(() => moveFilters(params)).toThrow(); });
