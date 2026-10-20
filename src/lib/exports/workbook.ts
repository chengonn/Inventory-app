import "server-only";
import * as XLSX from "xlsx";
import { MoveError } from "@/lib/moves/validation";
export type ExportSheet = {
  name: string;
  headers: string[];
  rows: unknown[][];
};
export const MAX_EXPORT_ROWS = 10000;
/** Decimal values arrive as strings: Excel numeric cells cannot preserve 18,3 precision. */
export function exportWorkbook(sheets: ExportSheet[]) {
  if (sheets.reduce((n, s) => n + s.rows.length, 0) > MAX_EXPORT_ROWS)
    throw new MoveError(
      "匯出超過 10000 列，請縮小篩選範圍；完整資料請使用管理員資料庫備份流程。",
    );
  if (Buffer.byteLength(JSON.stringify(sheets), "utf8") > 8 * 1024 * 1024)
    throw new MoveError("匯出資料量過大，請使用管理員資料庫備份流程。");
  const book = XLSX.utils.book_new();
  for (const source of sheets) {
    const sheet: XLSX.WorkSheet = {};
    const rows = [source.headers, ...source.rows];
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < source.headers.length; c++) {
        const value = rows[r][c];
        if (value === null || value === undefined) continue;
        const v =
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
            ? value
            : JSON.stringify(value);
        if (typeof v === "string" && v.length > 32767)
          throw new MoveError(
            "單一欄位超過 Excel 上限，請使用完整備份的 JSON 分段或資料庫備份。",
          );
        // Explicit string cells, never f/l: =,+,-,@ remain literal text without modifying source.
        sheet[XLSX.utils.encode_cell({ r, c })] = {
          t: typeof v === "number" ? "n" : typeof v === "boolean" ? "b" : "s",
          v,
        };
      }
    sheet["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length - 1, c: source.headers.length - 1 },
    });
    sheet["!autofilter"] = { ref: sheet["!ref"] };
    sheet["!cols"] = source.headers.map((h) => ({
      wch: /note|Json|原文|備註/i.test(h)
        ? 45
        : /date|At|日期/i.test(h)
          ? 26
          : 20,
    }));
    XLSX.utils.book_append_sheet(book, sheet, source.name);
  }
  const buffer = XLSX.write(book, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  }) as Buffer;
  if (buffer.length > 4 * 1024 * 1024)
    throw new MoveError("匯出檔案超過 4 MB，請縮小篩選或使用資料庫備份。");
  return buffer;
}
export function jsonChunks(value: unknown) {
  const text = JSON.stringify(value);
  if (!text) return [];
  const chunks: string[] = [];
  for (let start = 0; start < text.length; ) {
    let end = Math.min(start + 32000, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}
