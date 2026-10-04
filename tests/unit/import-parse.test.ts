import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { parseWorkbook } from "../../src/lib/imports/parse";
import { counts } from "../../src/lib/imports/model";
import { bytes, workbook } from "../fixtures/import-workbook";
const parse = (book = workbook()) => parseWorkbook(bytes(book), "inventory.xlsx");
it("recomputes quantities, ignores cached formulas, preserves provenance and archives", () => {
  const file = bytes(), plan = parseWorkbook(file, "inventory.xlsx");
  expect(plan.fileHash).toBe(createHash("sha256").update(file).digest("hex"));
  expect(plan.openings[0]).toMatchObject({ normalizedQty: "22.000", status: "CONFIRMED", rawQuantityText: "3組（6入/組）+4入", sourceCell: "工作表1!A9" });
  expect(plan.moves[0]).toMatchObject({ signedQty: "-2.000", occurredAt: "2026-08-31T16:00:00.000Z" });
  expect(plan.archives[0].normalizedQty).toBeNull();
  expect(plan.issues).toEqual([]);
  expect(counts(plan)).toMatchObject({ itemCount: 1, inventoryCount: 1, moveCount: 1, archiveCount: 1, reviewCount: 0 });
});
it.each(["1盒", "1羅裝", "1囖裝", "500cc（用了3/4）"])("unknown %s is review/null, never zero", (raw) => {
  const book = workbook(), sheet = book.Sheets.InventoryData;
  sheet.D2 = { t: "s", v: raw }; delete sheet.G2; delete sheet.H2;
  expect(parse(book).openings[0]).toMatchObject({ status: "NEEDS_REVIEW", normalizedQty: null, rawQuantityText: raw });
});
it("formulas in input cells are errors even without cached results", () => {
  const book = workbook(); book.Sheets.InventoryData.F2 = { t: "n", f: "1+2" };
  expect(parse(book).issues.some((r) => r.level === "error" && r.message.includes("公式"))).toBe(true);
});
it("formula-only template rows are skipped but orphan input rows are errors", () => {
  const book = workbook(), sheet = book.Sheets.StockMoves;
  XLSX.utils.sheet_add_aoa(sheet, [[null, null, null, null, null, null, null, null, null, null, null, { t: "n", f: "1+1" }]], { origin: "A3" });
  expect(parse(book).moves).toHaveLength(1);
  sheet.D3 = { t: "s", v: "orphan" };
  expect(parse(book).issues.some((r) => r.level === "error" && r.source === "StockMoves!A3")).toBe(true);
});
it.each([[-1, 2], [0.001, 0.001], [999999999999999, 999]])("rejects invalid/excess precision/overflow %s * %s", (a, b) => {
  const book = workbook(); book.Sheets.InventoryData.F2 = { t: "n", v: a }; book.Sheets.InventoryData.G2 = { t: "n", v: b };
  expect(parse(book).issues.some((r) => r.level === "error")).toBe(true);
});
it("unit mismatch and unknown master unit are review; no automatic conversion", () => {
  const book = workbook(); book.Sheets.StockMoves.K2 = { t: "s", v: "箱" };
  expect(parse(book).moves[0]).toMatchObject({ status: "NEEDS_REVIEW", signedQty: null });
  book.Sheets.品項設定.B2 = { t: "s", v: "未註明" };
  expect(parse(book).openings[0].status).toBe("NEEDS_REVIEW");
});
it("blank cabinet maps explicitly to 未編號 with warning", () => {
  const book = workbook(); delete book.Sheets.StockMoves.E2;
  const plan = parse(book); expect(plan.moves[0].cabinetNo).toBe("未編號");
  expect(plan.issues.some((r) => r.message.includes("空白櫃號"))).toBe(true);
});
it.each(["2026-02-30", "2026-01-01 25:00", "9/1/26"])("invalid date %s blocks the row", (date) => {
  const book = workbook(); book.Sheets.StockMoves.A2 = { t: "s", v: date };
  expect(parse(book).issues.some((r) => r.level === "error")).toBe(true);
});
it("missing sheet, wrong header, unknown item and duplicate names are blocking", () => {
  const book = workbook(); delete book.Sheets.移除紀錄;
  book.Sheets.StockMoves.F2 = { t: "s", v: "not in master" };
  XLSX.utils.sheet_add_aoa(book.Sheets.品項設定, [["Import fixture", "個"]], { origin: "A3" });
  expect(parse(book).issues.filter((r) => r.level === "error")).toHaveLength(3);
  book.Sheets.InventoryData.A1.v = "wrong";
  expect(parse(book).issues.some((r) => r.message.includes("欄位名稱"))).toBe(true);
});
it("rejects non-xlsx, oversized, invalid zip and expanded zip bombs", () => {
  expect(() => parseWorkbook(bytes(), "inventory.xls")).toThrow(".xlsx");
  expect(() => parseWorkbook(Buffer.alloc(3 * 1024 * 1024 + 1), "inventory.xlsx")).toThrow("3 MB");
  expect(() => parseWorkbook(Buffer.from("not a zip"), "inventory.xlsx")).toThrow();
  const file = bytes(); const central = file.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); file.writeUInt32LE(40 * 1024 * 1024, central + 24);
  expect(() => parseWorkbook(file, "inventory.xlsx")).toThrow("安全限制");
});
it("rejects oversized sheet instead of silently truncating", () => {
  const book = workbook(); XLSX.utils.sheet_add_aoa(book.Sheets.InventoryData, [["too far"]], { origin: "A3000" });
  expect(() => parse(book)).toThrow("列數");
});
it.skipIf(!process.env.IMPORT_SOURCE_FILE)("inspects the private source workbook without storing its data in Git or DB", () => {
  const plan = parseWorkbook(readFileSync(process.env.IMPORT_SOURCE_FILE!), "source.xlsx");
  console.log("Private workbook:", counts(plan), "errors:", plan.issues.filter((r) => r.level === "error"));
  expect(plan.issues.filter((r) => r.level === "error")).toEqual([]);
});
