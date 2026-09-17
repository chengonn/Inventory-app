import { beforeAll, afterAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { runtimePoolConfig } from "../../config/database";
import { insertMove, insertReversal } from "../../src/lib/moves/transaction";
import { parseMove } from "../../src/lib/moves/validation";
import { readLocationStock } from "../../src/lib/inventory/query";

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
