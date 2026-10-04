import "server-only";
import { Prisma } from "@/generated/prisma/client";

export function inventoryId(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) throw new Error("庫存查詢編號無效。");
  return value;
}

/** One SQL statement = one PostgreSQL snapshot. Never join the two ledgers. */
export function stockQuery(itemId?: number, locationId?: number) {
  const item = itemId === undefined ? Prisma.empty : Prisma.sql`AND "itemId" = ${inventoryId(itemId)}`;
  const location = locationId === undefined ? Prisma.empty : Prisma.sql`AND "locationId" = ${inventoryId(locationId)}`;
  return Prisma.sql`
    WITH ledger AS (
      SELECT "itemId", "locationId", "normalizedQty" AS opening, 0::numeric AS movement
      FROM inventory."OpeningInventory" WHERE status = 'CONFIRMED' ${item} ${location}
      UNION ALL
      SELECT "itemId", "locationId", 0::numeric AS opening, "signedQty" AS movement
      FROM inventory."StockMove" WHERE status = 'CONFIRMED' ${item} ${location}
    ), pairs AS (
      SELECT "itemId", "locationId", SUM(opening) AS "openingQty", SUM(movement) AS "movementQty",
        SUM(opening + movement) AS "currentQty"
      FROM ledger GROUP BY "itemId", "locationId"
    )
    SELECT *, SUM("currentQty") OVER (PARTITION BY "itemId") AS "itemTotalQty"
    FROM pairs ORDER BY "itemId", "locationId"`;
}

export type StockRow = { itemId: number; locationId: number; openingQty: Prisma.Decimal; movementQty: Prisma.Decimal; currentQty: Prisma.Decimal; itemTotalQty: Prisma.Decimal };

/** Internal helper for future authorized transaction services. Does NOT lock.
 * Step 7 must acquire per-pair locks BEFORE reading and writing stock.
 */
export async function readLocationStock(tx: Prisma.TransactionClient, itemId: number, locationId: number) {
  const rows = await tx.$queryRaw<StockRow[]>(stockQuery(itemId, locationId));
  return rows[0]?.currentQty ?? new Prisma.Decimal(0);
}
