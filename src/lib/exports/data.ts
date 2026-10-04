import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { readOverview } from "@/lib/inventory/browse";
import { filterInventory, searchOptions, type SearchParams } from "@/lib/inventory/read-model";
import { moveFilters } from "@/lib/moves/filter";
import { MAX_EXPORT_ROWS, jsonChunks, type ExportSheet } from "./workbook";
import { MoveError } from "@/lib/moves/validation";
export type ExportKind = "inventory" | "moves" | "backup";
const take = MAX_EXPORT_ROWS + 1;
const fields = {
  Items: ["id", "name", "unit", "safetyStock", "note", "isActive", "createdAt", "updatedAt"],
  Locations: ["id", "area", "cabinetNo", "displayName", "note", "isActive", "createdAt", "updatedAt"],
  OpeningInventory: ["id", "itemId", "locationId", "rawQuantityText", "containerType", "containerCount", "unitsPerContainer", "looseQty", "unit", "normalizedQty", "status", "sourceSheet", "sourceCell", "note", "importBatchId", "createdAt"],
  StockMoves: ["id", "moveNo", "occurredAt", "type", "itemId", "locationId", "rawQuantityText", "containerType", "containerCount", "unitsPerContainer", "looseQty", "unit", "normalizedQty", "signedQty", "status", "operator", "documentNo", "note", "reversalOfMoveId", "importBatchId", "createdAt"],
  ArchivedRecords: ["id", "removedAt", "area", "cabinetNo", "itemName", "rawQuantityText", "containerType", "containerCount", "unitsPerContainer", "looseQty", "unit", "normalizedQty", "originalStatus", "sourceCell", "removalReason", "note", "importBatchId", "createdAt"],
  ImportBatches: ["id", "fileName", "fileHash", "importedAt", "itemCount", "inventoryCount", "moveCount", "reviewCount"],
  AuditLogs: ["id", "action", "entityType", "entityId", "actorEmail", "beforeJson", "afterJson", "createdAt"],
};
function cell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === "object" && "toFixed" in value && typeof value.toFixed === "function") return value.toFixed(3);
  return value;
}
function table(name: keyof typeof fields, data: object[]): ExportSheet {
  return { name, headers: fields[name], rows: data.map((r) => fields[name].map((key) => cell((r as Record<string, unknown>)[key]))) };
}
/** Internal: route must authenticate and provide READ ONLY RepeatableRead transaction. */
export async function readExport(tx: Prisma.TransactionClient, kind: ExportKind, params: SearchParams, now = new Date()): Promise<ExportSheet[]> {
  const meta: ExportSheet = { name: "Metadata", headers: ["設定", "內容"], rows: [["匯出時間（UTC）", now.toISOString()], ["種類", kind], ["日期", "ISO 8601 UTC；畫面日期篩選以台北時間計算"], ["數量", "Decimal 以文字保留完整精度；NULL 留白，未知不視為零"], ["備份格式", "完整備份供追溯與管理員還原，不是 Step 10 原始 Excel 匯入範本"], ["Audit JSON", "若欄位為 @AuditJson:id:field，依 AuditJson 的 part 順序串接 jsonChunk 可還原完整 JSON"]] };
  if (kind === "inventory") {
    const options = searchOptions(params), overview = await readOverview(tx, now);
    const first = filterInventory(overview.rows, { ...options, page: 1 });
    const rows = [...first.rows];
    for (let page = 2; page <= first.pages; page++) rows.push(...filterInventory(overview.rows, { ...options, page }).rows);
    return [{ name: "Inventory", headers: ["品項", "單位", "區域", "櫃號", "已確認庫存", "全櫃位總量", "安全庫存", "低庫存", "狀態", "待確認筆數", "品項啟用", "櫃位啟用"], rows: rows.flatMap((r) => r.pairs.length ? r.pairs.map((p) => [r.name, r.unit, p.area, p.cabinetNo, p.current, r.current, r.safetyStock, r.low, p.hasConfirmed ? "CONFIRMED" : "NO_CONFIRMED_HISTORY", p.review, r.isActive, p.isActive]) : [[r.name, r.unit, null, null, "0.000", r.current, r.safetyStock, r.low, "NO_CONFIRMED_HISTORY", r.review, r.isActive, null]]) }, { ...meta, rows: [...meta.rows, ["搜尋", options.q], ["只看低庫存", options.low]] }];
  }
  if (kind === "moves") {
    const filters = moveFilters(params);
    const rows = await tx.stockMove.findMany({ where: filters.where, take, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], include: { item: { select: { name: true } }, location: { select: { area: true, cabinetNo: true } } } });
    const data = table("StockMoves", rows);
    data.headers = [...data.headers, "itemName", "area", "cabinetNo"];
    data.rows = data.rows.map((r, i) => [...r, rows[i].item.name, rows[i].location.area, rows[i].location.cabinetNo]);
    return [data, { ...meta, rows: [...meta.rows, ...["q", "type", "status", "from", "to"].map((key) => [key, filters[key as "q"]])] }];
  }
  const [auditSize] = await tx.$queryRaw<{ bytes: string }[]>`SELECT COALESCE(SUM(octet_length(COALESCE("beforeJson"::text,'')) + octet_length(COALESCE("afterJson"::text,''))),0)::text AS bytes FROM inventory."AuditLog"`;
  if (Number(auditSize.bytes) > 6 * 1024 * 1024) throw new MoveError("Audit 資料超過線上 Excel 備份容量，請使用管理員資料庫備份；不會截斷紀錄。");
  const [items, locations, openings, moves, archives, batches, audits] = await Promise.all([
    tx.item.findMany({ take, orderBy: { id: "asc" } }), tx.location.findMany({ take, orderBy: { id: "asc" } }), tx.openingInventory.findMany({ take, orderBy: { id: "asc" } }), tx.stockMove.findMany({ take, orderBy: { id: "asc" } }), tx.archivedRecord.findMany({ take, orderBy: { id: "asc" } }), tx.importBatch.findMany({ take, orderBy: { id: "asc" } }), tx.auditLog.findMany({ take, orderBy: { id: "asc" } }),
  ]);
  if ([items, locations, openings, moves, archives, batches, audits].reduce((n, rows) => n + rows.length, 0) > MAX_EXPORT_ROWS) throw new MoveError("完整備份超過 10000 列，請使用管理員資料庫備份，不會輸出不完整檔案。");
  const chunks: ExportSheet = { name: "AuditJson", headers: ["auditId", "field", "part", "parts", "jsonChunk"], rows: [] };
  const auditRows = audits.map((r) => {
    const mapped: Record<string, unknown> = { ...r };
    for (const field of ["beforeJson", "afterJson"] as const) {
      if (r[field] === null) continue;
      const values = jsonChunks(r[field]);
      if (values.length === 1) mapped[field] = values[0];
      else { mapped[field] = `@AuditJson:${r.id}:${field}`; values.forEach((value, i) => chunks.rows.push([r.id, field, i + 1, values.length, value])); }
    }
    return mapped;
  });
  const review: ExportSheet = { name: "NeedsReview", headers: ["entity", "id", "itemId", "locationId", "rawQuantityText", "unit", "note", "sourceSheet", "sourceCell"], rows: [...openings.filter((r) => r.status === "NEEDS_REVIEW").map((r) => ["OpeningInventory", r.id, r.itemId, r.locationId, r.rawQuantityText, r.unit, r.note, r.sourceSheet, r.sourceCell]), ...moves.filter((r) => r.status === "NEEDS_REVIEW").map((r) => ["StockMove", r.id, r.itemId, r.locationId, r.rawQuantityText, r.unit, r.note, null, r.moveNo])] };
  return [table("Items", items), table("Locations", locations), table("OpeningInventory", openings), table("StockMoves", moves), review, table("ArchivedRecords", archives), table("AuditLogs", auditRows), table("ImportBatches", batches), chunks, meta];
}
