import "server-only";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { MoveError, quantity, decimalText } from "@/lib/moves/validation";
import { IMPORT_VERSION, MAX_FILE_BYTES, MAX_ROWS, planSchema, type ImportPlan } from "./model";
import { validateXlsxZip } from "./zip";

export const HEADERS = {
  品項設定: ["品項", "換算單位", "安全庫存", "備註"],
  InventoryData: ["區域／櫃位群", "櫃號", "品項", "原始數量記錄", "容器類型", "容器數", "每容器數量", "零散數量", "換算單位", "可換算總數", "資料狀態", "原始位置", "備註"],
  StockMoves: ["日期", "異動單號", "異動類型", "區域", "櫃號", "品項", "容器類型", "容器數", "每容器數量", "零散數量", "換算單位", "交易總數", "庫存增減", "資料狀態", "經手人／領用人", "單據／申請單", "備註"],
  移除紀錄: ["移除日期", "原區域", "原櫃號", "品項", "原始數量記錄", "容器類型", "容器數", "每容器數量", "零散數量", "換算單位", "原可換算總數", "原資料狀態", "原始位置", "移除原因", "備註"],
} as const;
type SheetName = keyof typeof HEADERS;
const knownUnit = (unit: string | null) => !!unit && unit !== "未註明";
export function parseWorkbook(bytes: Buffer, fileName: string): ImportPlan {
  if (!/\.xlsx$/i.test(fileName) || fileName.length > 200 || /[/\\\x00-\x1f]/.test(fileName)) throw new MoveError("僅接受檔名長度 200 字以內的 .xlsx 檔案。");
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new MoveError("檔案須介於 1 byte 與 3 MB 之間。");
  validateXlsxZip(bytes);
  let book: XLSX.WorkBook;
  try { book = XLSX.read(bytes, { type: "buffer", cellFormula: true, cellHTML: false, cellText: false, cellDates: false, sheets: Object.keys(HEADERS), sheetRows: MAX_ROWS + 12 }); }
  catch { throw new MoveError("Excel 無法解析，請另存為標準 .xlsx 後重試。"); }
  const plan: ImportPlan = { version: IMPORT_VERSION, fileName, fileHash: createHash("sha256").update(bytes).digest("hex"), items: [], openings: [], moves: [], archives: [], issues: [] };
  const issue = (level: "warning" | "error", source: string, message: string) => plan.issues.push({ level, source, message });
  const itemMap = new Map<string, ImportPlan["items"][number]>();
  const moveNos = new Set<string>();
  let rowCount = 0;
  for (const name of Object.keys(HEADERS) as SheetName[]) {
    const sheet = book.Sheets[name];
    if (!sheet) { issue("error", name, "缺少必要工作表。"); continue; }
    const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"] ?? "A1");
    if (range.e.r > MAX_ROWS + 10 || range.e.c > 50) throw new MoveError(`${name} 超過列數或欄數限制。`);
    const at = (row: number, col: number): XLSX.CellObject | undefined => sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    const header = Array.from({ length: Math.min(10, range.e.r + 1) }, (_, r) => r).find((r) => HEADERS[name].every((h, c) => at(r, c)?.v === h && !at(r, c)?.f));
    if (header === undefined) { issue("error", name, "欄位名稱或順序不符來源範本。"); continue; }
    for (let r = header + 1; r <= range.e.r; r++) {
      const derived = name === "InventoryData" ? [9] : name === "StockMoves" ? [11, 12, 13] : name === "移除紀錄" ? [10] : [];
      const used = HEADERS[name].some((_, c) => !derived.includes(c) && !(name === "InventoryData" && c === 10 && at(r, c)?.f) && (at(r, c)?.f || (at(r, c)?.v !== undefined && at(r, c)?.v !== "")));
      if (!used) continue; // Formula-only template rows are not inventory.
      if (++rowCount > MAX_ROWS) throw new MoveError("實際資料總列數不可超過 2000。");
      const source = `${name}!A${r + 1}`;
      const text = (c: number, max = 2000): string | null => {
        const cell = at(r, c);
        if (!cell || cell.v === undefined || cell.v === "") { if (cell?.f || cell?.F) throw new MoveError(`${HEADERS[name][c]} 不接受公式。`); return null; }
        if (cell.f || cell.F || cell.t === "e" || !["string", "number"].includes(typeof cell.v)) throw new MoveError(`${HEADERS[name][c]} 不接受公式或錯誤值。`);
        const value = String(cell.v).trim();
        if (value.length > max) throw new MoveError(`${HEADERS[name][c]} 超過 ${max} 字。`);
        return value || null;
      };
      const required = (c: number, max = 200) => { const value = text(c, max); if (!value) throw new MoveError(`${HEADERS[name][c]} 必填。`); return value; };
      const number = (c: number) => { const n = quantity(text(c, 30), false); return n === null ? null : decimalText(n); };
      const date = (c: number, optional = false) => {
        const raw = text(c, 60);
        if (!raw && optional) return null;
        if (!raw) throw new MoveError("日期必填。");
        let year: number, month: number, day: number, hour = 0, minute = 0, second = 0;
        if (at(r, c)?.t === "n") {
          const parts = XLSX.SSF.parse_date_code(Number(raw), { date1904: !!book.Workbook?.WBProps?.date1904 });
          if (!parts) throw new MoveError("Excel 日期無效。");
          ({ y: year, m: month, d: day, H: hour, M: minute, S: second } = parts);
        } else {
          const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
          if (!match) throw new MoveError("日期須為 YYYY-MM-DD，可附 HH:mm:ss；時區為台北。");
          [, year, month, day, hour, minute, second] = match.map((v) => Number(v ?? 0));
        }
        const value = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
        if (year < 1900 || year > 2100 || value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) throw new MoveError("日期不存在或超出 1900–2100 年。");
        return new Date(value.getTime() - 8 * 3600000).toISOString();
      };
      try {
        if (name === "品項設定") {
          const item = { name: required(0), unit: text(1, 40), safetyStock: number(2), note: text(3) };
          if (itemMap.has(item.name)) throw new MoveError("品項主檔名稱重複。");
          itemMap.set(item.name, item); plan.items.push(item); continue;
        }
        const archive = name === "移除紀錄", move = name === "StockMoves";
        const itemName = required(move ? 5 : archive ? 3 : 2);
        const item = itemMap.get(itemName);
        if (!archive && !item) throw new MoveError("品項不在「品項設定」，請先補齊主檔。");
        const area = text(move ? 3 : archive ? 1 : 0, 100);
        const cabinet = text(move ? 4 : archive ? 2 : 1, 100);
        if (!archive && !area) throw new MoveError("區域必填。");
        if (!archive && !cabinet) issue("warning", source, "空白櫃號將歸入「未編號」，請核對位置。");
        const base = move ? 6 : archive ? 5 : 4;
        const containerType = text(base, 40), containerCount = number(base + 1), unitsPerContainer = number(base + 2), looseQty = number(base + 3);
        const unit = text(base + 4, 40) ?? item?.unit ?? null;
        const statusCol = move ? 13 : archive ? 11 : 10;
        const originalStatus = !archive && at(r, statusCol)?.f ? null : text(statusCol, 100);
        const rawQuantityText = move ? [containerType && `${containerCount ?? "?"}${containerType}`, unitsPerContainer && `每容器${unitsPerContainer}`, looseQty && `零散${looseQty}`].filter(Boolean).join("；") || null : text(archive ? 4 : 3, 300);
        let normalizedQty: string | null = null;
        if (containerCount !== null && unitsPerContainer !== null) {
          const product = quantity(containerCount)! * quantity(unitsPerContainer)!;
          if (product % BigInt(1000)) throw new MoveError("換算結果超過 3 位小數，不會自動四捨五入。");
          normalizedQty = decimalText(product / BigInt(1000) + (quantity(looseQty, false) ?? BigInt(0)));
        } else if (containerCount === null && unitsPerContainer === null && looseQty !== null) normalizedQty = looseQty;
        if (normalizedQty !== null) quantity(normalizedQty); // exact numeric(18,3) bound
        const reasons: string[] = [];
        if (normalizedQty === null) reasons.push("換算資訊不足");
        if (originalStatus && !["可換算", "可計算", "CONFIRMED", "IGNORED", "已忽略"].includes(originalStatus)) reasons.push(`來源狀態：${originalStatus}`);
        if (!knownUnit(unit)) reasons.push("標準單位未確認");
        if (item && knownUnit(unit) && (!knownUnit(item.unit) || unit !== item.unit)) reasons.push("與品項主檔單位不一致或主檔單位未確認");
        const status = ["IGNORED", "已忽略"].includes(originalStatus ?? "") ? "IGNORED" as const : reasons.length ? "NEEDS_REVIEW" as const : "CONFIRMED" as const;
        if (status !== "CONFIRMED") normalizedQty = null;
        if (reasons.length && !archive) issue("warning", source, `${reasons.join("；")}，不計入已確認庫存。`);
        const note = [text(move ? 16 : archive ? 14 : 12), `Excel ${source}`, reasons.length ? reasons.join("；") : null].filter(Boolean).join("\n");
        if (note.length > 2000) throw new MoveError("備註連同來源追溯資訊超過 2000 字。");
        const data = { rawQuantityText, containerType, containerCount, unitsPerContainer, looseQty, unit, normalizedQty, status, note, sourceSheet: name, sourceCell: move ? source : text(archive ? 12 : 11, 300) ?? source, row: r + 1, itemName };
        if (archive) { plan.archives.push({ ...data, area, cabinetNo: cabinet, removedAt: date(0, true), originalStatus, removalReason: text(13) }); continue; }
        const line = { ...data, area: area!, cabinetNo: cabinet ?? "未編號" };
        if (!move) { plan.openings.push(line); continue; }
        const types = { 入庫: "IN", 出庫: "OUT", 盤盈: "ADJUST_GAIN", 盤虧: "ADJUST_LOSS", 盤損: "ADJUST_LOSS", IN: "IN", OUT: "OUT", ADJUST_GAIN: "ADJUST_GAIN", ADJUST_LOSS: "ADJUST_LOSS" } as const;
        const kind = required(2) as keyof typeof types;
        if (!Object.hasOwn(types, kind)) throw new MoveError("異動類型無效；沖銷請使用 App 的 reversal 流程。");
        const type = types[kind], moveNo = text(1, 100) ?? `XL-${plan.fileHash}-${r + 1}`;
        if (moveNos.has(moveNo)) throw new MoveError("異動單號重複。");
        moveNos.add(moveNo);
        if (normalizedQty === "0.000") throw new MoveError("交易數量必須大於零。");
        plan.moves.push({ ...line, moveNo, occurredAt: date(0)!, type, signedQty: normalizedQty === null ? null : ["OUT", "ADJUST_LOSS"].includes(type) ? `-${normalizedQty}` : normalizedQty, operator: text(14, 100), documentNo: text(15, 100) });
      } catch (error) { if (!(error instanceof MoveError)) throw error; issue("error", source, error.message); }
    }
  }
  if (!rowCount) issue("error", "Workbook", "沒有可匯入資料。");
  if (Buffer.byteLength(JSON.stringify(plan), "utf8") > 1024 * 1024) throw new MoveError("解析後的資料超過 1 MB，請縮短備註或分拆檔案。");
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) throw new MoveError("解析資料超過欄位限制，請檢查來源檔。");
  return parsed.data;
}
