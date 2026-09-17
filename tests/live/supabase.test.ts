import { afterAll, expect, it } from "vitest";
import { getPrisma } from "../../src/lib/prisma";

// Explicitly opt-in; uses the real server client and only read-only transactions.
const prisma = getPrisma();
afterAll(async () => { await prisma.$disconnect(); });

it("queries the real transaction pooler through generated Prisma and pg", async () => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.$queryRaw<{ ok: number }[]>`SELECT 1::int AS ok`;
  });
  expect(result).toEqual([{ ok: 1 }]);
});

it("has both migrations applied with matching local SQL checksums", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const rows = await prisma.$queryRaw<{ migration_name: string; checksum: string; finished: boolean }[]>`
    SELECT migration_name, checksum, finished_at IS NOT NULL AS finished
    FROM inventory._prisma_migrations WHERE rolled_back_at IS NULL ORDER BY migration_name`;
  const names = ["202609070001_initial_inventory", "202609070002_inventory_integrity"];
  expect(rows.map((r) => r.migration_name)).toEqual(names);
  for (const row of rows) {
    expect(row.finished).toBe(true);
    expect(row.checksum).toBe(createHash("sha256").update(readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`)).digest("hex"));
  }
});

it("has seven business tables with RLS and no browser schema access", async () => {
  const rows = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
    SELECT relname,relrowsecurity FROM pg_class
    WHERE relnamespace='inventory'::regnamespace AND relkind='r' AND relname <> '_prisma_migrations'`;
  expect(rows.map((r) => r.relname).sort()).toEqual(["ArchivedRecord", "AuditLog", "ImportBatch", "Item", "Location", "OpeningInventory", "StockMove"]);
  expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  const grants = await prisma.$queryRaw<{ allowed: boolean }[]>`
    SELECT has_schema_privilege('anon','inventory','USAGE')
      OR has_schema_privilege('authenticated','inventory','USAGE') AS allowed`;
  expect(grants).toEqual([{ allowed: false }]);
});

it("can read all seven models in a read-only transaction", async () => {
  const counts = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return Promise.all([tx.item.count(), tx.location.count(), tx.openingInventory.count(),
      tx.stockMove.count(), tx.archivedRecord.count(), tx.importBatch.count(), tx.auditLog.count()]);
  });
  expect(counts.every((count) => Number.isInteger(count) && count >= 0)).toBe(true);
});
