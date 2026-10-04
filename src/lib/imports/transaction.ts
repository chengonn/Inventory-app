import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/policy";
import { stockQuery } from "@/lib/inventory/query";
import { lockRequest, lockStockPair } from "@/lib/moves/transaction";
import { MoveError } from "@/lib/moves/validation";
import { counts, planSchema, type ImportPlan, type ImportLine } from "./model";

export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const locationKey = (row: { area: string; cabinetNo: string }) => JSON.stringify([row.area, row.cabinetNo]);
const pairKey = (row: ImportLine) => JSON.stringify([row.itemName, row.area, row.cabinetNo]);
export async function inspectImport(tx: Prisma.TransactionClient, plan: ImportPlan) {
  const issues = [...plan.issues];
  const error = (source: string, message: string) => issues.push({ level: "error", source, message });
  const [items, locations, stock, openings, moves, duplicate] = await Promise.all([
    tx.item.findMany({ where: { name: { in: plan.items.map((r) => r.name) } } }), tx.location.findMany(),
    tx.$queryRaw<{ itemId: number; locationId: number; currentQty: Prisma.Decimal }[]>(stockQuery()),
    tx.openingInventory.findMany({ select: { itemId: true, locationId: true } }),
    tx.stockMove.findMany({ where: { moveNo: { in: plan.moves.map((r) => r.moveNo) } }, select: { moveNo: true } }),
    tx.importBatch.findUnique({ where: { fileHash: plan.fileHash }, select: { id: true } }),
  ]);
  const itemMap = new Map(items.map((r) => [r.name, r])), locationMap = new Map(locations.map((r) => [locationKey(r), r]));
  const existingOpenings = new Set(openings.map((r) => `${r.itemId}:${r.locationId}`));
  const stockMap = new Map(stock.map((r) => [`${r.itemId}:${r.locationId}`, r.currentQty]));
  if (duplicate) error("Workbook", `此檔案已匯入（批次 ${duplicate.id}），不可再次確認。`);
  for (const row of plan.items) {
    const existing = itemMap.get(row.name);
    if (!existing) continue;
    if (!existing.isActive) error(row.name, "現有品項已停用，匯入不會自動重新啟用。");
    if (existing.unit !== row.unit) error(row.name, "現有主檔與 Excel 的單位不同，請先核對主檔。");
    if ((existing.safetyStock?.toFixed(3) ?? null) !== row.safetyStock || existing.note !== row.note) issues.push({ level: "warning", source: row.name, message: "沿用現有主檔的安全庫存與備註，不覆寫。" });
  }
  for (const row of moves) error(row.moveNo, "異動單號已存在，不可重複匯入。");
  const balances = new Map<string, Prisma.Decimal>();
  for (const row of [...plan.openings, ...plan.moves]) {
    const loc = locationMap.get(locationKey(row)), item = itemMap.get(row.itemName), key = pairKey(row);
    if (loc && !loc.isActive) error(`${row.sourceSheet}!A${row.row}`, "現有櫃位已停用。");
    if (!balances.has(key)) balances.set(key, item && loc ? stockMap.get(`${item.id}:${loc.id}`) ?? new Prisma.Decimal(0) : new Prisma.Decimal(0));
  }
  for (const row of plan.openings) {
    const loc = locationMap.get(locationKey(row)), item = itemMap.get(row.itemName);
    if (item && loc && existingOpenings.has(`${item.id}:${loc.id}`)) error(`${row.sourceSheet}!A${row.row}`, "此品項／櫃位已有期初資料；禁止疊加期初，避免修改檔案後重複計數。");
    if (row.status === "CONFIRMED") balances.set(pairKey(row), balances.get(pairKey(row))!.plus(row.normalizedQty!));
  }
  // Reproduce historical order, with worksheet row as the tie breaker.
  for (const row of [...plan.moves].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.row - b.row)) {
    if (row.status !== "CONFIRMED") continue;
    const next = balances.get(pairKey(row))!.plus(row.signedQty!);
    if (next.isNegative()) error(`${row.sourceSheet}!A${row.row}`, "此異動會使已確認庫存小於零；待確認數量不可支撐出庫。");
    balances.set(pairKey(row), next);
  }
  return { issues, duplicate: duplicate?.id ?? null, items, locations, effects: [...balances].map(([key, value]) => { const [itemName, area, cabinetNo] = JSON.parse(key) as string[]; return { itemName, area, cabinetNo, after: value.toFixed(3) }; }) };
}

/** Internal, authenticated caller required. All writes and audit share this transaction. */
export async function commitImportTransaction(tx: Prisma.TransactionClient, actor: Actor, token: string, now = new Date()) {
  // Global import lock also orders creation of missing masters between different files.
  await lockRequest(tx, "inventory-import");
  const preview = await tx.auditLog.findFirst({ where: { action: "IMPORT_PREVIEW", entityType: "ImportPreview", entityId: token, actorEmail: actor.email } });
  const saved = preview?.afterJson as { userId?: string; expiresAt?: string; plan?: unknown } | undefined;
  if (!saved || saved.userId !== actor.id || !saved.expiresAt || new Date(saved.expiresAt) <= now) throw new MoveError("預覽不存在、已過期或不屬於此帳號，請重新上傳預覽。");
  const validated = planSchema.safeParse(saved.plan);
  if (!validated.success) throw new MoveError("預覽版本不相容，請重新上傳。");
  const plan = validated.data;
  if (plan.issues.some((i) => i.level === "error")) throw new MoveError("預覽仍有錯誤，不可匯入。");
  if (await tx.importBatch.findUnique({ where: { fileHash: plan.fileHash } })) throw new MoveError("此檔案已匯入，不會重複寫入。請查閱匯入紀錄。");
  const names = plan.items.map((r) => r.name);
  const createdItems = await tx.item.createManyAndReturn({ data: [...plan.items].sort((a, b) => a.name.localeCompare(b.name)), skipDuplicates: true });
  const distinctLocations = [...new Map([...plan.openings, ...plan.moves].map((r) => [locationKey(r), { area: r.area, cabinetNo: r.cabinetNo }])).values()];
  const createdLocations = await tx.location.createManyAndReturn({ data: distinctLocations.sort((a, b) => locationKey(a).localeCompare(locationKey(b))), skipDuplicates: true });
  const items = await tx.item.findMany({ where: { name: { in: names } } }), locations = await tx.location.findMany();
  const itemMap = new Map(items.map((r) => [r.name, r])), locationMap = new Map(locations.map((r) => [locationKey(r), r]));
  const ids = (r: ImportLine) => ({ itemId: itemMap.get(r.itemName)!.id, locationId: locationMap.get(locationKey(r))!.id });
  const pairs = [...new Map([...plan.openings, ...plan.moves].map((r) => { const pair = ids(r); return [`${pair.itemId}:${pair.locationId}`, pair]; })).values()].sort((a, b) => a.itemId - b.itemId || a.locationId - b.locationId);
  for (const pair of pairs) await lockStockPair(tx, pair.itemId, pair.locationId);
  // Same SHARE master protection as moves, batched to keep serverless latency bounded.
  if (pairs.length) {
    const itemIds = [...new Set(pairs.map((p) => p.itemId))], locationIds = [...new Set(pairs.map((p) => p.locationId))];
    await tx.$queryRaw(Prisma.sql`SELECT id FROM inventory."Item" WHERE id IN (${Prisma.join(itemIds)}) ORDER BY id FOR SHARE`);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM inventory."Location" WHERE id IN (${Prisma.join(locationIds)}) ORDER BY id FOR SHARE`);
  }
  // NEW statements after advisory lock waits, with ReadCommitted isolation.
  const inspection = await inspectImport(tx, plan);
  const failure = inspection.issues.find((i) => i.level === "error");
  if (failure) throw new MoveError(`${failure.source}：${failure.message}`);
  const summary = counts(plan);
  const { archiveCount, confirmedCount, ...batchCounts } = summary;
  const batch = await tx.importBatch.create({ data: { fileName: plan.fileName, fileHash: plan.fileHash, ...batchCounts } });
  const quantityData = (r: ImportPlan["openings"][number] | ImportPlan["archives"][number]) => ({ rawQuantityText: r.rawQuantityText, containerType: r.containerType, containerCount: r.containerCount, unitsPerContainer: r.unitsPerContainer, looseQty: r.looseQty, unit: r.unit, normalizedQty: r.normalizedQty, note: r.note, importBatchId: batch.id });
  const openingRows = await tx.openingInventory.createManyAndReturn({ data: plan.openings.map((r) => ({ ...quantityData(r), ...ids(r), status: r.status, sourceSheet: r.sourceSheet, sourceCell: r.sourceCell })) });
  const moveRows = await tx.stockMove.createManyAndReturn({ data: plan.moves.map((r) => ({ ...quantityData(r), ...ids(r), status: r.status, moveNo: r.moveNo, occurredAt: new Date(r.occurredAt), type: r.type, signedQty: r.signedQty, operator: r.operator, documentNo: r.documentNo })) });
  const archiveRows = await tx.archivedRecord.createManyAndReturn({ data: plan.archives.map((r) => ({ ...quantityData(r), area: r.area, cabinetNo: r.cabinetNo, itemName: r.itemName, removedAt: r.removedAt ? new Date(r.removedAt) : null, originalStatus: r.originalStatus, sourceCell: r.sourceCell, removalReason: r.removalReason })) });
  const audits = [
    ...openingRows.map((r) => ({ entityType: "OpeningInventory", entityId: String(r.id), afterJson: json(r) })),
    ...moveRows.map((r) => ({ entityType: "StockMove", entityId: String(r.id), afterJson: json(r) })),
    ...archiveRows.map((r) => ({ entityType: "ArchivedRecord", entityId: String(r.id), afterJson: json(r) })),
    ...createdItems.map((r) => ({ entityType: "Item", entityId: String(r.id), afterJson: json(r) })),
    ...createdLocations.map((r) => ({ entityType: "Location", entityId: String(r.id), afterJson: json(r) })),
    { entityType: "ImportBatch", entityId: String(batch.id), afterJson: json({ ...batch, archiveCount, confirmedCount, previewToken: token }) },
  ];
  await tx.auditLog.createMany({ data: audits.map((r) => ({ ...r, action: "IMPORT", actorEmail: actor.email })) });
  return { id: batch.id, fileName: batch.fileName, fileHash: batch.fileHash, ...summary };
}
