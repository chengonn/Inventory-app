import { beforeAll, afterAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { runtimePoolConfig } from "../../config/database";
import { insertMove, insertReversal } from "../../src/lib/moves/transaction";
import { parseMove } from "../../src/lib/moves/validation";
import { readLocationStock } from "../../src/lib/inventory/query";
import { parseStocktake } from "../../src/lib/stocktake/validation";
import { commitStocktakeTransaction } from "../../src/lib/stocktake/transaction";
import { readOverview } from "../../src/lib/inventory/browse";
import { parseWorkbook } from "../../src/lib/imports/parse";
import { commitImportTransaction, inspectImport, json } from "../../src/lib/imports/transaction";
import type { ImportPlan } from "../../src/lib/imports/model";
import { bytes, workbook } from "../fixtures/import-workbook";
import { parseReview } from "../../src/lib/review/validation";
import { commitReviewTransaction } from "../../src/lib/review/transaction";
import { readExport } from "../../src/lib/exports/data";
import { exportWorkbook } from "../../src/lib/exports/workbook";
import * as XLSX from "xlsx";

// Committed races need separate connections. All fixtures live in a newly owned,
// disposable schema; business inventory and its immutable history are untouched.
const schema = `inventory_test_${crypto.randomUUID().replaceAll("-", "")}`;
const config = runtimePoolConfig(process.env.DATABASE_URL, "6", process.env.DATABASE_SSL_CA);
const admin = new Pool(config), pool = new Pool(config);
const rewrite = (sql: string) => sql.replace(/"inventory"\./g, `"${schema}".`).replace(/\binventory\./g, `${schema}.`);
pool.on("connect", (client) => {
  const query = client.query;
  client.query = function (this: typeof client, first: unknown, ...args: unknown[]) {
    const next = typeof first === "string" ? rewrite(first) : { ...(first as object), text: rewrite((first as { text: string }).text) };
    return Reflect.apply(query, this, [next, ...args]);
  } as typeof client.query;
});
const db = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "inventory" }) });
const actor = { id: "step7-test", email: "step7-test@example.invalid" };
const options = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000, maxWait: 5000 };
let created = false;
beforeAll(async () => {
  if (!/^inventory_test_[0-9a-f]{32}$/.test(schema)) throw new Error("Unsafe test schema");
  await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
  for (const name of ["202609070001_initial_inventory", "202609070002_inventory_integrity"]) {
    const sql = (await readFile(`prisma/migrations/${name}/migration.sql`, "utf8")).replace(/\binventory\b/g, schema);
    await admin.query(sql);
  }
}, 60000);
afterAll(async () => {
  await db.$disconnect(); await pool.end();
  try { if (created && /^inventory_test_[0-9a-f]{32}$/.test(schema)) { await admin.query(`DROP SCHEMA "${schema}" CASCADE`); expect((await admin.query("SELECT 1 FROM pg_namespace WHERE nspname=$1", [schema])).rowCount).toBe(0); } }
  finally { await admin.end(); }
}, 60000);
async function fixture(opening = "10") {
  const name = crypto.randomUUID();
  const item = await db.item.create({ data: { name, unit: "個" } });
  const location = await db.location.create({ data: { area: name, cabinetNo: "1" } });
  if (opening !== "none") await db.openingInventory.create({ data: { itemId: item.id, locationId: location.id, normalizedQty: opening } });
  return { itemId: item.id, locationId: location.id };
}
function input(pair: { itemId: number; locationId: number }, kind = "OUT", quantity = "7", extra: Record<string, string> = {}) {
  const form = new FormData(); for (const [key, value] of Object.entries({ requestId: crypto.randomUUID(), ...pair, mode: "direct", quantity, ...extra })) form.set(key, String(value));
  return parseMove(kind, form);
}
const move = (data: ReturnType<typeof input>) => db.$transaction((tx) => insertMove(tx, actor, data), options);
const reverse = (originalId: number, requestId = crypto.randomUUID()) => db.$transaction((tx) => insertReversal(tx, actor, { originalId, requestId, note: "fixture reversal" }), options);
function countInput(locationId: number, lines: [number, string][], requestId = crypto.randomUUID()) {
  const form = new FormData(); form.set("locationId", String(locationId)); form.set("requestId", requestId); form.set("note", "physical count");
  for (const [itemId, actual] of lines) form.set(`actual-${itemId}`, actual);
  return parseStocktake(form);
}
const count = (data: ReturnType<typeof countInput>) => db.$transaction((tx) => commitStocktakeTransaction(tx, actor, data), options);
function reviewInput(entity: string, id: number, extra: Record<string, string> = {}) {
  const data = new FormData(); for (const [k, v] of Object.entries({ entity, id: String(id), requestId: crypto.randomUUID(), decision: "CONFIRM", mode: "direct", quantity: "2.125", unit: "個", reason: "verified fixture", ...extra })) data.set(k, v); return parseReview(data);
}
const review = (data: ReturnType<typeof reviewInput>) => db.$transaction((tx) => commitReviewTransaction(tx, actor, data), options);
it("review confirmation preserves source, updates stock exactly once and writes before/after audits", async () => {
  const pair = await fixture("none"), row = await db.openingInventory.create({ data: { ...pair, status: "NEEDS_REVIEW", rawQuantityText: "1盒", sourceSheet: "InventoryData", sourceCell: "A10" } });
  const data = reviewInput("OpeningInventory", row.id);
  const result = await Promise.all([review(data), review(data)]);
  expect(result.map((r) => r.replayed).sort()).toEqual([false, true]);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("2.125");
  const after = await db.openingInventory.findUniqueOrThrow({ where: { id: row.id } });
  expect(after.rawQuantityText).toBe("1盒"); expect(after.sourceCell).toBe("A10"); expect(after.status).toBe("CONFIRMED");
  expect(await db.auditLog.count({ where: { action: "REVIEW", entityType: "OpeningInventory", entityId: String(row.id) } })).toBe(1);
  await expect(review(reviewInput("OpeningInventory", row.id))).rejects.toThrow("已處理");
  await expect(review({ ...data, reason: "changed" })).rejects.toThrow("不同處理");
});
it("unknown master unit blocks confirm but reasoned ignore preserves history and contributes zero", async () => {
  const pair = await fixture(), row = await db.stockMove.create({ data: { ...pair, moveNo: crypto.randomUUID(), occurredAt: new Date(), type: "IN", status: "NEEDS_REVIEW", rawQuantityText: "1羅裝" } });
  await db.item.update({ where: { id: pair.itemId }, data: { unit: "未註明" } });
  await expect(review(reviewInput("StockMove", row.id))).rejects.toThrow("標準單位");
  await review(reviewInput("StockMove", row.id, { decision: "IGNORE", reason: "無法核對，留存歷史" }));
  const after = await db.stockMove.findUniqueOrThrow({ where: { id: row.id } });
  expect(after.status).toBe("IGNORED"); expect(after.normalizedQty).toBeNull(); expect(after.rawQuantityText).toBe("1羅裝");
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("10.000");
});
it("review audit failure rolls back status and quantity, permitting safe retry", async () => {
  const pair = await fixture(), row = await db.stockMove.create({ data: { ...pair, moveNo: crypto.randomUUID(), occurredAt: new Date(), type: "OUT", status: "NEEDS_REVIEW" } }), data = reviewInput("StockMove", row.id);
  await expect(db.$transaction((tx) => {
    const faulty = new Proxy(tx, { get(target, key) { if (key === "auditLog") return { findFirst: tx.auditLog.findFirst.bind(tx.auditLog), create: async () => { throw new Error("review audit failure"); } }; return Reflect.get(target, key); } });
    return commitReviewTransaction(faulty, actor, data);
  }, options)).rejects.toThrow("review audit failure");
  expect((await db.stockMove.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("NEEDS_REVIEW");
  await review(data);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("7.875");
  await expect(db.stockMove.update({ where: { id: row.id }, data: { note: "cannot change confirmed" } })).rejects.toThrow();
});
it("review OUT and normal OUT wait on the same pair lock, preventing negative stock", async () => {
  const pair = await fixture(), row = await db.stockMove.create({ data: { ...pair, moveNo: crypto.randomUUID(), occurredAt: new Date(), type: "OUT", status: "NEEDS_REVIEW" } });
  const blocker = await admin.connect(); await blocker.query("BEGIN"); await blocker.query("SELECT pg_advisory_xact_lock($1::int,$2::int)", [pair.itemId, pair.locationId]);
  const race = Promise.allSettled([review(reviewInput("StockMove", row.id, { quantity: "7" })), move(input(pair))]);
  try {
    let waiting = 0;
    for (let i = 0; i < 100 && waiting < 2; i++) { const result = await admin.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND classid=$1::oid AND objid=$2::oid AND objsubid=2 AND NOT granted", [pair.itemId, pair.locationId]); waiting = result.rows[0].n; if (waiting < 2) await new Promise((r) => setTimeout(r, 50)); }
    expect(waiting).toBe(2);
  } finally { await blocker.query("ROLLBACK"); blocker.release(); }
  expect((await race).filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("3.000");
});
it("filtered exports cover all pages; backup JSON chunks restore every audit value", async () => {
  const pair = await fixture("none"), item = await db.item.findUniqueOrThrow({ where: { id: pair.itemId } });
  await db.stockMove.createMany({ data: Array.from({ length: 51 }, (_, i) => ({ ...pair, moveNo: crypto.randomUUID(), occurredAt: new Date("2026-09-01T00:00:00Z"), type: "IN" as const, status: "CONFIRMED" as const, normalizedQty: "0.001", signedQty: "0.001", note: String(i) })) });
  const long = { text: "😀備份".repeat(18000) }, audit = await db.auditLog.create({ data: { action: "fixture", entityType: "ExportFixture", afterJson: json(long) } });
  const data = await db.$transaction(async (tx) => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return readExport(tx, "moves", { q: item.name, type: "IN", from: "2026-09-01", to: "2026-09-01", page: "2" }); }, { isolationLevel: "RepeatableRead" });
  expect(data[0].rows).toHaveLength(51);
  const backup = await db.$transaction(async (tx) => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return readExport(tx, "backup", {}); }, { isolationLevel: "RepeatableRead", timeout: 15000 });
  const book = XLSX.read(exportWorkbook(backup), { type: "buffer" });
  expect(book.SheetNames).toEqual(expect.arrayContaining(["Items", "Locations", "OpeningInventory", "StockMoves", "NeedsReview", "ArchivedRecords", "AuditLogs", "ImportBatches", "AuditJson"]));
  const chunks = XLSX.utils.sheet_to_json<{ auditId: number; field: string; part: number; jsonChunk: string }>(book.Sheets.AuditJson).filter((r) => r.auditId === audit.id && r.field === "afterJson").sort((a, b) => a.part - b.part);
  expect(JSON.parse(chunks.map((r) => r.jsonChunk).join(""))).toEqual(long);
});
function importPlan() { return parseWorkbook(bytes(workbook(crypto.randomUUID())), "fixture.xlsx"); }
async function savePreview(plan: ImportPlan, expiresAt = new Date(Date.now() + 60000).toISOString()) {
  const token = crypto.randomUUID();
  await db.auditLog.create({ data: { action: "IMPORT_PREVIEW", entityType: "ImportPreview", entityId: token, actorEmail: actor.email, afterJson: json({ userId: actor.id, expiresAt, plan }) } });
  return token;
}
const importCommit = (token: string) => db.$transaction((tx) => commitImportTransaction(tx, actor, token), options);
it("Excel commit imports all four sheets and atomic audits; archive does not count as stock", async () => {
  const plan = importPlan(), token = await savePreview(plan);
  const check = await db.$transaction((tx) => inspectImport(tx, plan));
  expect(check.issues).toEqual([]); expect(check.effects[0].after).toBe("20.000");
  expect(await db.item.count({ where: { name: plan.items[0].name } })).toBe(0);
  const result = await importCommit(token);
  expect(result).toMatchObject({ inventoryCount: 1, moveCount: 1, archiveCount: 1 });
  const row = await db.stockMove.findFirstOrThrow({ where: { importBatchId: result.id } });
  expect((await readLocationStock(db, row.itemId, row.locationId)).toFixed(3)).toBe("20.000");
  expect(await db.auditLog.count({ where: { action: "IMPORT", entityType: "StockMove", entityId: String(row.id) } })).toBe(1);
  expect(await db.auditLog.count({ where: { action: "IMPORT", entityType: "Location", entityId: String(row.locationId) } })).toBe(1);
  const duplicate = await db.$transaction((tx) => inspectImport(tx, plan));
  expect(duplicate.duplicate).toBe(result.id);
  await expect(importCommit(token)).rejects.toThrow("已匯入");
});
it("concurrent same hash with two preview tokens commits exactly once", async () => {
  const plan = importPlan(), first = await savePreview(plan), second = await savePreview(plan);
  const result = await Promise.allSettled([importCommit(first), importCommit(second)]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.importBatch.count({ where: { fileHash: plan.fileHash } })).toBe(1);
});
it("changed workbook hash cannot add opening twice to an existing pair", async () => {
  const plan = importPlan(); await importCommit(await savePreview(plan));
  const changed = { ...plan, fileHash: "a".repeat(64), moves: [] };
  await expect(importCommit(await savePreview(changed))).rejects.toThrow("已有期初");
  expect(await db.importBatch.count({ where: { fileHash: changed.fileHash } })).toBe(0);
});
it("expired, missing, wrong actor and incompatible preview cannot commit", async () => {
  const plan = importPlan(), expired = await savePreview(plan, "2000-01-01T00:00:00.000Z"), valid = await savePreview(plan);
  await expect(importCommit(expired)).rejects.toThrow("過期");
  await expect(importCommit(crypto.randomUUID())).rejects.toThrow("不存在");
  await expect(db.$transaction((tx) => commitImportTransaction(tx, { ...actor, id: "other" }, valid), options)).rejects.toThrow("不屬於");
  await db.auditLog.updateMany({ where: { entityId: valid }, data: { afterJson: json({ userId: actor.id, expiresAt: new Date(Date.now() + 60000).toISOString(), plan: { ...plan, version: 999 } }) } });
  await expect(importCommit(valid)).rejects.toThrow("版本");
  expect(await db.importBatch.count({ where: { fileHash: plan.fileHash } })).toBe(0);
});
it("review stock cannot fund imported OUT; failure rolls back new masters, rows and batch", async () => {
  const plan = importPlan(); plan.openings[0].status = "NEEDS_REVIEW"; plan.openings[0].normalizedQty = null;
  await expect(importCommit(await savePreview(plan))).rejects.toThrow("小於零");
  expect(await db.item.count({ where: { name: plan.items[0].name } })).toBe(0);
  expect(await db.importBatch.count({ where: { fileHash: plan.fileHash } })).toBe(0);
});
it("audit failure rolls back the entire import and the same preview can retry", async () => {
  const plan = importPlan(), token = await savePreview(plan);
  await expect(db.$transaction((tx) => {
    const faulty = new Proxy(tx, { get(target, key) { if (key === "auditLog") return { findFirst: tx.auditLog.findFirst.bind(tx.auditLog), createMany: async () => { throw new Error("injected import audit failure"); } }; return Reflect.get(target, key); } });
    return commitImportTransaction(faulty, actor, token);
  }, options)).rejects.toThrow("injected import audit failure");
  expect(await db.importBatch.count({ where: { fileHash: plan.fileHash } })).toBe(0);
  expect(await db.stockMove.count({ where: { moveNo: plan.moves[0].moveNo } })).toBe(0);
  expect(await db.item.count({ where: { name: plan.items[0].name } })).toBe(0);
  await expect(importCommit(token)).resolves.toMatchObject({ inventoryCount: 1 });
});
it("imported OUT races with normal OUT using the same pair lock; only one succeeds", async () => {
  const pair = await fixture("10"), item = await db.item.findUniqueOrThrow({ where: { id: pair.itemId } });
  const plan = importPlan(); plan.items = [{ name: item.name, unit: "個", safetyStock: null, note: null }]; plan.openings = []; plan.archives = [];
  plan.moves[0] = { ...plan.moves[0], itemName: item.name, area: item.name, cabinetNo: "1", normalizedQty: "7.000", signedQty: "-7.000" };
  const token = await savePreview(plan), blocker = await admin.connect();
  await blocker.query("BEGIN"); await blocker.query("SELECT pg_advisory_xact_lock($1::int,$2::int)", [pair.itemId, pair.locationId]);
  const race = Promise.allSettled([importCommit(token), move(input(pair))]);
  try {
    let waiting = 0;
    for (let i = 0; i < 100 && waiting < 2; i++) { const result = await admin.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND classid=$1::oid AND objid=$2::oid AND objsubid=2 AND NOT granted", [pair.itemId, pair.locationId]); waiting = result.rows[0].n; if (waiting < 2) await new Promise((r) => setTimeout(r, 50)); }
    expect(waiting).toBe(2);
  } finally { await blocker.query("ROLLBACK"); blocker.release(); }
  const result = await race; expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("3.000");
});
it.skipIf(!process.env.IMPORT_SOURCE_FILE)("private source preview checks balances in disposable DB without committing its inventory", async () => {
  const plan = parseWorkbook(await readFile(process.env.IMPORT_SOURCE_FILE!), "source.xlsx");
  const result = await db.$transaction((tx) => inspectImport(tx, plan), options);
  console.log("Private source preview", { items: plan.items.length, openings: plan.openings.length, moves: plan.moves.length, archives: plan.archives.length, errors: result.issues.filter((r) => r.level === "error") });
  expect(result.issues.filter((r) => r.level === "error")).toEqual([]);
});
it("two actual concurrent OUTs wait on the pair lock: one commits, one rejects, stock stays 3", async () => {
  const pair = await fixture();
  const blocker = await admin.connect();
  await blocker.query("BEGIN"); await blocker.query("SELECT pg_advisory_xact_lock($1::int,$2::int)", [pair.itemId, pair.locationId]);
  const race = Promise.allSettled([move(input(pair)), move(input(pair))]);
  try {
    let waiting = 0;
    for (let i = 0; i < 80 && waiting < 2; i++) {
      const result = await admin.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND classid=$1::oid AND objid=$2::oid AND objsubid=2 AND NOT granted", [pair.itemId, pair.locationId]);
      waiting = result.rows[0].n; if (waiting < 2) await new Promise((r) => setTimeout(r, 50));
    }
    expect(waiting).toBe(2);
  } finally { await blocker.query("ROLLBACK"); blocker.release(); }
  const results = await race;
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  expect(failure.reason.message).toContain("庫存不足");
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("3.000");
  const rows = await db.stockMove.findMany({ where: pair }); expect(rows).toHaveLength(1);
  expect(await db.auditLog.count({ where: { entityType: "StockMove", entityId: String(rows[0].id) } })).toBe(1);
});
it("concurrent retries create one move and audit; changed payload cannot reuse key", async () => {
  const pair = await fixture("none"), data = input(pair, "IN", "1.125");
  const results = await Promise.all([move(data), move(data)]);
  expect(results[0].id).toBe(results[1].id); expect(results.map((r) => r.replayed).sort()).toEqual([false, true]);
  await expect(move({ ...data, note: "different" })).rejects.toThrow("不同交易");
  expect(await db.auditLog.count({ where: { entityId: String(results[0].id), entityType: "StockMove" } })).toBe(1);
});
it("unknown IN does not fund OUT, including pairs with no opening row", async () => {
  const pair = await fixture("none");
  expect((await move(input(pair, "IN", "1", { mode: "container", containerType: "盒", containerCount: "9" }))).status).toBe("NEEDS_REVIEW");
  await expect(move(input(pair, "OUT", "0.001"))).rejects.toThrow("庫存不足");
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("0.000");
});
it("concurrent reversals preserve original, create one opposite move, reject repeated/reversal-of-reversal", async () => {
  const pair = await fixture(), original = await move(input(pair));
  const before = await db.stockMove.findUniqueOrThrow({ where: { id: original.id } });
  const results = await Promise.allSettled([reverse(original.id), reverse(original.id)]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.stockMove.findUniqueOrThrow({ where: { id: original.id } })).toEqual(before);
  const reversal = await db.stockMove.findUniqueOrThrow({ where: { reversalOfMoveId: original.id } });
  expect(reversal.signedQty?.toFixed(3)).toBe("7.000");
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("10.000");
  await expect(reverse(reversal.id)).rejects.toThrow("僅可沖銷");
  await expect(reverse(original.id)).rejects.toThrow("已沖銷");
});
it("rejects IN reversal that would make stock negative and rejects inactive new moves", async () => {
  const pair = await fixture("none"), original = await move(input(pair, "IN", "10"));
  const out = await move(input(pair, "OUT", "7"));
  await expect(reverse(original.id)).rejects.toThrow("小於零");
  await db.item.update({ where: { id: pair.itemId }, data: { isActive: false } });
  await expect(move(input(pair, "IN", "1"))).rejects.toThrow("停用");
  await reverse(out.id); // Historical correction remains possible after deactivation.
  await reverse(original.id);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("0.000");
});
it("audit failure rolls back inserted move, releases lock, and permits safe retry", async () => {
  const pair = await fixture(), data = input(pair, "OUT", "1");
  await expect(db.$transaction(async (tx) => {
    const faulty = new Proxy(tx, { get(target, key) { if (key === "auditLog") return { create: async () => { throw new Error("injected audit failure"); } }; return Reflect.get(target, key); } });
    return insertMove(faulty, actor, data);
  }, options)).rejects.toThrow("injected audit failure");
  expect(await db.stockMove.count({ where: { moveNo: `MV-${data.requestId}` } })).toBe(0);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("10.000");
  await move(data);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("9.000");
});
it("OUT and negative reversal share the same lock and cannot spend the same stock", async () => {
  const pair = await fixture("none"), original = await move(input(pair, "IN", "10"));
  const results = await Promise.allSettled([move(input(pair, "OUT", "7")), reverse(original.id)]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(["0.000", "3.000"]).toContain((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3));
  expect(await db.stockMove.count({ where: pair })).toBe(2);
});
it("reversal retry returns the existing receipt without another audit", async () => {
  const pair = await fixture(), original = await move(input(pair, "OUT", "1")), key = crypto.randomUUID();
  const first = await reverse(original.id, key), second = await reverse(original.id, key);
  expect(second).toMatchObject({ id: first.id, replayed: true });
  expect(await db.auditLog.count({ where: { entityId: String(first.id), entityType: "StockMove", actorEmail: actor.email, action: "REVERSE" } })).toBe(1);
});
it("stocktake batches gain, loss and zero difference with atomic actor audits", async () => {
  const pair = await fixture(), ids = [pair.itemId];
  for (let i = 0; i < 2; i++) {
    const item = await db.item.create({ data: { name: crypto.randomUUID(), unit: "個" } }); ids.push(item.id);
    await db.openingInventory.create({ data: { itemId: item.id, locationId: pair.locationId, normalizedQty: "10" } });
  }
  const data = countInput(pair.locationId, [[ids[0], "12.125"], [ids[1], "4"], [ids[2], "10"]]);
  const result = await count(data);
  expect(result.rows.map((r) => r.type)).toEqual(["ADJUST_GAIN", "ADJUST_LOSS", null]);
  expect(result.rows.map((r) => r.signedQty)).toEqual(["2.125", "-6.000", "0.000"]);
  expect(result.rows[2].moveId).toBeNull();
  for (const r of result.rows) expect((await readLocationStock(db, r.itemId, pair.locationId)).toFixed(3)).toBe(r.actual);
  expect(await db.stockMove.count({ where: { locationId: pair.locationId } })).toBe(2);
  const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: "Stocktake", entityId: `ST-${data.requestId}` } });
  expect(audit.actorEmail).toBe(actor.email);
  expect(audit.beforeJson).toEqual(ids.map((itemId) => ({ itemId, currentQty: "10.000" })));
  for (const r of result.rows.filter((r) => r.moveId)) expect(await db.auditLog.count({ where: { entityType: "StockMove", entityId: String(r.moveId), actorEmail: actor.email } })).toBe(1);
});
it("zero-difference stocktake receipt prevents replay from undoing a later OUT", async () => {
  const pair = await fixture(), data = countInput(pair.locationId, [[pair.itemId, "10"]]);
  const first = await count(data); expect(first.rows[0].moveId).toBeNull();
  await move(input(pair, "OUT", "2"));
  const retry = await count(data); expect(retry.replayed).toBe(true); expect(retry.rows).toEqual(first.rows);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("8.000");
  expect(await db.stockMove.count({ where: pair })).toBe(1);
  await expect(count({ ...data, lines: [{ itemId: pair.itemId, actual: "11.000" }] })).rejects.toThrow("不同內容");
});
it("stocktake waits for uncommitted OUT then recalculates delta from committed stock", async () => {
  const pair = await fixture();
  let release!: () => void, inserted!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { inserted = resolve; });
  const outgoing = db.$transaction(async (tx) => { const r = await insertMove(tx, actor, input(pair, "OUT", "7")); inserted(); await gate; return r; }, options);
  // Attach rejection handler immediately so a DB failure cannot leave ready hanging.
  await Promise.race([ready, outgoing]);
  const counting = count(countInput(pair.locationId, [[pair.itemId, "5"]]));
  try {
    let waiting = 0;
    for (let i = 0; i < 50 && !waiting; i++) {
      waiting = (await admin.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND classid=$1::oid AND objid=$2::oid AND objsubid=2 AND NOT granted", [pair.itemId, pair.locationId])).rows[0].n;
      if (!waiting) await new Promise((r) => setTimeout(r, 50));
    }
    expect(waiting).toBe(1);
  } finally { release(); }
  await outgoing;
  const result = await counting;
  expect(result.rows[0]).toMatchObject({ current: "3.000", actual: "5.000", signedQty: "2.000", type: "ADJUST_GAIN" });
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("5.000");
});
it("concurrent stocktake retries create a single adjustment and receipt", async () => {
  const pair = await fixture(), data = countInput(pair.locationId, [[pair.itemId, "4"]]);
  const results = await Promise.all([count(data), count(data)]);
  expect(results.map((r) => r.replayed).sort()).toEqual([false, true]);
  expect(await db.stockMove.count({ where: pair })).toBe(1);
  expect(await db.auditLog.count({ where: { entityType: "Stocktake", entityId: `ST-${data.requestId}` } })).toBe(1);
});
it("opposite input order in overlapping multi-item counts does not deadlock or double-adjust", async () => {
  const pair = await fixture(), second = await db.item.create({ data: { name: crypto.randomUUID() } });
  await db.openingInventory.create({ data: { itemId: second.id, locationId: pair.locationId, normalizedQty: "10" } });
  const results = await Promise.all([count(countInput(pair.locationId, [[pair.itemId, "5"], [second.id, "5"]])), count(countInput(pair.locationId, [[second.id, "5"], [pair.itemId, "5"]]))]);
  expect(results.flatMap((r) => r.rows).filter((r) => r.moveId)).toHaveLength(2);
  expect(await db.stockMove.count({ where: { locationId: pair.locationId } })).toBe(2);
});
it("stocktake batch audit failure rolls back all adjustments and per-move audits", async () => {
  const pair = await fixture(), data = countInput(pair.locationId, [[pair.itemId, "1"]]);
  await expect(db.$transaction((tx) => {
    const faulty = new Proxy(tx, { get(target, key) {
      if (key === "auditLog") return { findFirst: tx.auditLog.findFirst.bind(tx.auditLog), create: async (args: Prisma.AuditLogCreateArgs) => { if (args.data.entityType === "Stocktake") throw new Error("batch audit unavailable"); return tx.auditLog.create(args); } };
      return Reflect.get(target, key);
    } });
    return commitStocktakeTransaction(faulty, actor, data);
  }, options)).rejects.toThrow("batch audit unavailable");
  expect(await db.stockMove.count({ where: pair })).toBe(0);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("10.000");
  expect(await db.auditLog.count({ where: { entityId: `ST-${data.requestId}` } })).toBe(0);
  await count(data); // Rollback released the locks and did not consume the request.
});
it("an inactive later row rolls back earlier rows in the same stocktake", async () => {
  const pair = await fixture(), inactive = await db.item.create({ data: { name: crypto.randomUUID(), isActive: false } });
  const data = countInput(pair.locationId, [[pair.itemId, "0"], [inactive.id, "5"]]);
  await expect(count(data)).rejects.toThrow("停用");
  expect(await db.stockMove.count({ where: { locationId: pair.locationId } })).toBe(0);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("10.000");
});
it("stocktake ignores unknown quantities and adjustments can be reversed through the existing service", async () => {
  const pair = await fixture("none");
  await move(input(pair, "IN", "1", { mode: "container", containerType: "箱", containerCount: "99" }));
  const result = await count(countInput(pair.locationId, [[pair.itemId, "2.125"]]));
  expect(result.rows[0]).toMatchObject({ current: "0.000", signedQty: "2.125", type: "ADJUST_GAIN" });
  await reverse(result.rows[0].moveId!);
  expect((await readLocationStock(db, pair.itemId, pair.locationId)).toFixed(3)).toBe("0.000");
});
const overview = (now = new Date("2030-01-01T00:00:00Z")) => db.$transaction(async (tx) => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; return readOverview(tx, now); }, { ...options, isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
it("dashboard uses confirmed global balances, pending counts, Taipei day bounds and exact thresholds", async () => {
  const baseline = await overview(), pair = await fixture("2");
  await db.item.update({ where: { id: pair.itemId }, data: { safetyStock: "10", isActive: false } });
  const extra = await db.location.create({ data: { area: crypto.randomUUID(), cabinetNo: "other", isActive: false } });
  await db.openingInventory.createMany({ data: [{ ...pair, normalizedQty: null, status: "NEEDS_REVIEW" }, { itemId: pair.itemId, locationId: extra.id, normalizedQty: "6" }, { ...pair, normalizedQty: "999", status: "IGNORED" }] });
  for (const [at, type, qty, status] of [
    ["2029-12-31T16:00:00Z", "IN", "1", "CONFIRMED"], ["2030-01-01T15:59:59.999Z", "OUT", "-1", "CONFIRMED"],
    ["2029-12-31T15:59:59.999Z", "IN", "1", "CONFIRMED"], ["2030-01-01T16:00:00Z", "OUT", "-1", "CONFIRMED"],
    ["2030-01-01T00:00:00Z", "IN", null, "NEEDS_REVIEW"],
  ] as const) await db.stockMove.create({ data: { ...pair, moveNo: crypto.randomUUID(), occurredAt: new Date(at), type, status, signedQty: qty, normalizedQty: qty === null ? null : new Prisma.Decimal(qty).abs() } });
  const data = await overview(), row = data.rows.find((r) => r.id === pair.itemId)!;
  expect(row).toMatchObject({ current: "8.000", low: true, isActive: false, review: 2 }); expect(row.pairs).toHaveLength(2);
  expect(data.metrics.total).toBe(baseline.metrics.total + 1); expect(data.metrics.low).toBe(baseline.metrics.low + 1);
  expect(data.metrics.stocked).toBe(baseline.metrics.stocked + 1); expect(data.metrics.review).toBe(baseline.metrics.review + 2);
  expect(data.metrics.todayIn).toBe(baseline.metrics.todayIn + 1); expect(data.metrics.todayOut).toBe(baseline.metrics.todayOut + 1);
  expect(data.recent).toHaveLength(10); expect(data.recent[0].at).toBe("2030-01-01T16:00:00.000Z");
});
it("read-only RepeatableRead overview remains consistent across a concurrent committed IN", async () => {
  const pair = await fixture("10");
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const before = await readOverview(tx, new Date());
    await move(input(pair, "IN", "2"));
    const after = await readOverview(tx, new Date());
    expect(before.rows.find((r) => r.id === pair.itemId)?.current).toBe("10.000");
    expect(after.rows.find((r) => r.id === pair.itemId)?.current).toBe("10.000");
  }, { ...options, isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  expect((await overview()).rows.find((r) => r.id === pair.itemId)?.current).toBe("12.000");
});
