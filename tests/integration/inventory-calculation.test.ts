import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { stockQuery } from "../../src/lib/inventory/query";
let db: PGlite;
let item: number;
let location: number;
let second: number;
let sequence = 0;
beforeAll(async () => {
  db = new PGlite();
  for (const name of ["202609070001_initial_inventory", "202609070002_inventory_integrity"]) await db.exec(readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => {
  await db.exec("BEGIN");
  item = (await db.query<{ id: number }>(`INSERT INTO inventory."Item" (name,"updatedAt") VALUES ('test',now()) RETURNING id`)).rows[0].id;
  const locs = (await db.query<{ id: number }>(`INSERT INTO inventory."Location" (area,"cabinetNo","updatedAt") VALUES ('A','1',now()),('A','2',now()) RETURNING id`)).rows;
  [location, second] = locs.map((r) => r.id);
});
afterEach(async () => db.exec("ROLLBACK"));
async function opening(qty: string | null, loc = location, status = "CONFIRMED") {
  await db.query(`INSERT INTO inventory."OpeningInventory" ("itemId","locationId","normalizedQty",status) VALUES ($1,$2,$3,$4)`, [item, loc, qty, status]);
}
async function move(type: string, signed: string | null, status = "CONFIRMED", loc = location, reversal: number | null = null) {
  return (await db.query<{ id: number }>(`INSERT INTO inventory."StockMove" ("moveNo","occurredAt",type,"itemId","locationId","normalizedQty","signedQty",status,"reversalOfMoveId") VALUES ($1,now(),$2,$3,$4,abs($5::numeric),$5,$6,$7) RETURNING id`, [String(++sequence), type, item, loc, signed, status, reversal])).rows[0].id;
}
type Row = { itemId: number; locationId: number; openingQty: string; movementQty: string; currentQty: string; itemTotalQty: string };
async function calculate(id?: number) { const sql = stockQuery(id); return (await db.query<Row>(sql.text, sql.values)).rows; }
it("sums multiple opening rows and movements without multiplying joined records", async () => {
  await opening("60"); await opening("40"); await move("IN", "20"); await move("OUT", "-10");
  expect((await calculate())[0]).toMatchObject({ openingQty: "100.000", movementQty: "10.000", currentQty: "110.000" });
});
it("keeps locations separate and sums all locations once per item", async () => {
  await opening("10"); await opening("7", second); await move("OUT", "-2");
  const rows = await calculate(item);
  expect(rows.map((r) => r.currentQty)).toEqual(["8.000", "7.000"]);
  expect(rows.every((r) => r.itemTotalQty === "15.000")).toBe(true);
});
it("excludes NEEDS_REVIEW and IGNORED from both ledgers even when ignored keeps quantities", async () => {
  await opening("5"); await opening(null, location, "NEEDS_REVIEW"); await opening("1000", location, "IGNORED");
  await move("IN", null, "NEEDS_REVIEW"); await move("IN", "900", "IGNORED");
  expect((await calculate())[0].currentQty).toBe("5.000");
});
it("uses signed quantities for gains, losses and reversal without removing the original", async () => {
  await opening("10"); const original = await move("OUT", "-4");
  await move("REVERSAL", "4", "CONFIRMED", location, original);
  await move("ADJUST_GAIN", "2"); await move("ADJUST_LOSS", "-1");
  expect((await calculate())[0].currentQty).toBe("11.000");
});
it("includes move-only locations and preserves a negative balance for diagnosis", async () => {
  await move("OUT", "-3");
  expect((await calculate())[0]).toMatchObject({ openingQty: "0", currentQty: "-3.000" });
});
it("keeps zero balance pairs, but does not invent pairs for only unreviewed quantities", async () => {
  await opening("0"); await opening(null, second, "NEEDS_REVIEW");
  const rows = await calculate(); expect(rows).toHaveLength(1); expect(rows[0].currentQty).toBe("0.000");
});
it("retains historical stock when item and location are inactive", async () => {
  await opening("8"); await db.query(`UPDATE inventory."Item" SET "isActive"=false WHERE id=$1`, [item]);
  await db.query(`UPDATE inventory."Location" SET "isActive"=false WHERE id=$1`, [location]);
  expect((await calculate())[0].currentQty).toBe("8.000");
});
it("preserves decimal arithmetic and sum precision beyond a single numeric(18,3) row", async () => {
  for (let i=0;i<11;i++) await opening("999999999999999.999");
  await move("IN", "0.001");
  expect((await calculate())[0].currentQty).toBe("10999999999999999.990");
});
it("filters by parameterized item ID and returns no fabricated results for missing history", async () => {
  await opening("12"); expect(await calculate(item + 10000)).toEqual([]);
  const sql = stockQuery(item, location); expect(sql.values).toEqual([item, location, item, location]);
});
it("adds reviewed opening quantity only after confirmation", async () => {
  await opening(null, location, "NEEDS_REVIEW"); expect(await calculate()).toEqual([]);
  await db.query(`UPDATE inventory."OpeningInventory" SET status='CONFIRMED',"normalizedQty"=22 WHERE "itemId"=$1`, [item]);
  expect((await calculate())[0].currentQty).toBe("22.000");
});
it("does not include archived records or mix other item totals", async () => {
  await opening("7");
  await db.query(`INSERT INTO inventory."ArchivedRecord" ("itemName","normalizedQty") VALUES ('test',999)`);
  const other = (await db.query<{ id: number }>(`INSERT INTO inventory."Item" (name,"updatedAt") VALUES ('other',now()) RETURNING id`)).rows[0].id;
  await db.query(`INSERT INTO inventory."OpeningInventory" ("itemId","locationId","normalizedQty") VALUES ($1,$2,5)`, [other, location]);
  const rows = await calculate();
  expect(rows.find((r) => r.itemId === item)?.itemTotalQty).toBe("7.000");
  expect(rows.find((r) => r.itemId === other)?.itemTotalQty).toBe("5.000");
});
