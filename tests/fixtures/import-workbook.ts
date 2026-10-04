import * as XLSX from "xlsx";
// Test-only workbook; never contains company inventory.
export const headers = {
  品項設定: ["品項", "換算單位", "安全庫存", "備註"],
  InventoryData: ["區域／櫃位群", "櫃號", "品項", "原始數量記錄", "容器類型", "容器數", "每容器數量", "零散數量", "換算單位", "可換算總數", "資料狀態", "原始位置", "備註"],
  StockMoves: ["日期", "異動單號", "異動類型", "區域", "櫃號", "品項", "容器類型", "容器數", "每容器數量", "零散數量", "換算單位", "交易總數", "庫存增減", "資料狀態", "經手人／領用人", "單據／申請單", "備註"],
  移除紀錄: ["移除日期", "原區域", "原櫃號", "品項", "原始數量記錄", "容器類型", "容器數", "每容器數量", "零散數量", "換算單位", "原可換算總數", "原資料狀態", "原始位置", "移除原因", "備註"],
};
export function workbook(name = "Import fixture") {
  const book = XLSX.utils.book_new();
  const rows: Record<string, unknown[][]> = {
    品項設定: [[name, "個", 3, null]],
    InventoryData: [[name, "1", name, "3組（6入/組）+4入", "組", 3, 6, 4, "個", 999999, "可換算", "工作表1!A9", null]],
    StockMoves: [["2026-09-01", null, "出庫", name, "1", name, null, null, null, 2, "個", 999, -999, "可計算", null, null, null]],
    移除紀錄: [["2026-08-01", name, "1", "Archived fixture", "1盒", "盒", 1, null, null, "個", 999, "待確認", "工作表1!A99", "已移除", null]],
  };
  for (const [sheet, columns] of Object.entries(headers)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([columns, ...rows[sheet]]), sheet);
  book.Sheets.InventoryData.J2 = { t: "n", v: 999999, f: "HYPERLINK(\"https://example.invalid\",1)" };
  return book;
}
export const bytes = (book = workbook()) => XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
