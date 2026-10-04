import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// In-memory PostgreSQL WASM ONLY for SQL tests; never used by application code.
// This does NOT execute Prisma migrate deploy or connect to Supabase.
let db: PGlite;
let itemId: number;
let locationId: number;

beforeAll(async () => {
  db = new PGlite();
  // Simulate Supabase browser roles, including inherited default table grants.
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;');
  for (const name of ["202609070001_initial_inventory", "202609070002_inventory_integrity"]) {
    await db.exec(readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
  }
}, 30_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("BEGIN");
  itemId = (await db.query<{ id: number }>('INSERT INTO inventory."Item" (name, "updatedAt") VALUES ($1, now()) RETURNING id', ["測試品項"])).rows[0].id;
  locationId = (await db.query<{ id: number }>('INSERT INTO inventory."Location" (area, "cabinetNo", "updatedAt") VALUES ($1,$2,now()) RETURNING id', ["A", "01"])).rows[0].id;
});
afterEach(async () => { await db.exec("ROLLBACK"); });

async function move(moveNo: string, type = "IN", qty: string | null = "5", signed: string | null = "5", status = "CONFIRMED", reversal: number | null = null) {
  return (await db.query<{ id: number }>(`INSERT INTO inventory."StockMove"
    ("moveNo", "occurredAt", type, "itemId", "locationId", "normalizedQty", "signedQty", status, "reversalOfMoveId")
    VALUES ($1,now(),$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [moveNo, type, itemId, locationId, qty, signed, status, reversal])).rows[0].id;
}

describe("PostgreSQL V2 schema and integrity SQL", () => {
  it("creates all seven business tables with RLS enabled", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>("SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='inventory'::regnamespace AND relkind='r'");
    expect(result.rows.map((r) => r.relname).sort()).toEqual(["ArchivedRecord", "AuditLog", "ImportBatch", "Item", "Location", "OpeningInventory", "StockMove"]);
    expect(result.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it.each(["anon", "authenticated"])("revokes schema/table grants from %s", async (role) => {
    const result = await db.query<{ schema: boolean; table: boolean }>(`SELECT has_schema_privilege($1,'inventory','USAGE') AS schema, has_table_privilege($1,'inventory."Item"','SELECT') AS table`, [role]);
    expect(result.rows[0]).toEqual({ schema: false, table: false });
  });
  it("stores quantities as decimal(18,3) without floating-point loss", async () => {
    const result = await db.query<{ quantity: string }>('INSERT INTO inventory."OpeningInventory" ("itemId","locationId","normalizedQty") VALUES ($1,$2,0.1+0.2) RETURNING "normalizedQty"::text AS quantity', [itemId, locationId]);
    expect(result.rows[0].quantity).toBe("0.300");
    const column = await db.query<{ numeric_precision: number; numeric_scale: number }>("SELECT numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='inventory' AND table_name='OpeningInventory' AND column_name='normalizedQty'");
    expect(column.rows[0]).toEqual({ numeric_precision: 18, numeric_scale: 3 });
  });
  it("keeps names unique even after deactivation", async () => {
    await db.query('UPDATE inventory."Item" SET "isActive"=false WHERE id=$1', [itemId]);
    await expect(db.query('INSERT INTO inventory."Item" (name,"updatedAt") VALUES ($1,now())', ["測試品項"])).rejects.toMatchObject({ code: "23505" });
  });
  it("enforces area/cabinet uniqueness", async () => {
    await expect(db.query('INSERT INTO inventory."Location" (area,"cabinetNo","updatedAt") VALUES ($1,$2,now())', ["A", "01"])).rejects.toMatchObject({ code: "23505" });
  });
  it("represents an unknown quantity as NULL and permits review confirmation", async () => {
    const id = await move("review", "IN", null, null, "NEEDS_REVIEW");
    const original = await db.query<{ normalizedQty: null }>('SELECT "normalizedQty" FROM inventory."StockMove" WHERE id=$1', [id]);
    expect(original.rows[0].normalizedQty).toBeNull();
    await db.query('UPDATE inventory."StockMove" SET status=\'CONFIRMED\',"normalizedQty"=22,"signedQty"=22 WHERE id=$1', [id]);
  });
  it.each([
    ["IN", "5", "-5", "CONFIRMED"],
    ["OUT", "5", "5", "CONFIRMED"],
    ["IN", null, null, "CONFIRMED"],
    ["IN", "0", "0", "NEEDS_REVIEW"],
    ["IN", "NaN", "NaN", "CONFIRMED"],
  ])("rejects inconsistent quantities/status (%s, %s, %s, %s)", async (type, qty, signed, status) => {
    await expect(move("bad", type!, qty, signed, status!)).rejects.toMatchObject({ code: "23514" });
  });
  it("requires confirmed opening quantities; unknown openings cannot normalize to zero", async () => {
    await expect(db.query('INSERT INTO inventory."OpeningInventory" ("itemId","locationId",status,"normalizedQty") VALUES ($1,$2,\'NEEDS_REVIEW\',0)', [itemId, locationId])).rejects.toMatchObject({ code: "23514" });
  });
  it("allows ignored records to retain known historical quantities", async () => {
    const id = await move("ignored", "OUT", "5", "-5", "IGNORED");
    const result = await db.query<{ status: string; signed: string }>('SELECT status,"signedQty"::text AS signed FROM inventory."StockMove" WHERE id=$1', [id]);
    expect(result.rows[0]).toEqual({ status: "IGNORED", signed: "-5.000" });
  });
  it("prevents duplicate reversals through the unique self-relation", async () => {
    const id = await move("original");
    await move("reversal", "REVERSAL", "5", "-5", "CONFIRMED", id);
    await expect(move("duplicate", "REVERSAL", "5", "-5", "CONFIRMED", id)).rejects.toMatchObject({ code: "23505" });
  });
  it("requires reversal reference", async () => {
    await expect(move("reversal", "REVERSAL", "5", "-5")).rejects.toMatchObject({ code: "23514" });
  });
  it("prevents deleting any StockMove, including review rows", async () => {
    const id = await move("review", "IN", null, null, "NEEDS_REVIEW");
    await expect(db.query('DELETE FROM inventory."StockMove" WHERE id=$1', [id])).rejects.toMatchObject({ code: "23514" });
  });
  it("prevents truncate from bypassing history preservation", async () => {
    await expect(db.exec('TRUNCATE inventory."StockMove"')).rejects.toMatchObject({ code: "23514" });
  });
  it("prevents editing a confirmed transaction", async () => {
    const id = await move("confirmed");
    await expect(db.query('UPDATE inventory."StockMove" SET "normalizedQty"=6,"signedQty"=6 WHERE id=$1', [id])).rejects.toMatchObject({ code: "23514" });
  });
  it("protects item history with a foreign key", async () => {
    await move("history");
    await expect(db.query('DELETE FROM inventory."Item" WHERE id=$1', [itemId])).rejects.toMatchObject({ code: "23503" });
  });
  it("prevents duplicate import hashes", async () => {
    await db.query('INSERT INTO inventory."ImportBatch" ("fileName","fileHash") VALUES ($1,$2)', ["fixture.xlsx", "a".repeat(64)]);
    await expect(db.query('INSERT INTO inventory."ImportBatch" ("fileName","fileHash") VALUES ($1,$2)', ["renamed.xlsx", "a".repeat(64)])).rejects.toMatchObject({ code: "23505" });
  });
  it("rejects non-SHA256 import hashes", async () => {
    await expect(db.query('INSERT INTO inventory."ImportBatch" ("fileName","fileHash") VALUES ($1,$2)', ["fixture.xlsx", "not-sha256"])).rejects.toMatchObject({ code: "23514" });
  });
});
