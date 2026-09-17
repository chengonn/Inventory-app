import "server-only";
import { createClient } from "@/lib/supabase/server";
import { verifyActor } from "@/lib/auth/policy";
import { getPrisma } from "@/lib/prisma";
import { stockQuery, type StockRow } from "./query";

/** Confirmed normalized balances, including inactive items and locations.
 * Empty history yields no pair; it is NOT an assertion that physical stock is 0.
 * Decimal quantities cross the service boundary as exact fixed-scale strings.
 */
export async function calculateStock(itemId?: number) {
  const actor = await verifyActor(await createClient());
  if (actor.status !== "allowed") throw new Error("沒有庫存查詢權限或登入已失效。");
  const query = stockQuery(itemId);
  const rows = await getPrisma().$queryRaw<StockRow[]>(query);
  const totals = new Map<number, string>();
  const locations = rows.map((row) => {
    totals.set(row.itemId, row.itemTotalQty.toFixed(3));
    return { itemId: row.itemId, locationId: row.locationId,
      openingQty: row.openingQty.toFixed(3), movementQty: row.movementQty.toFixed(3), currentQty: row.currentQty.toFixed(3) };
  });
  return { locations, items: Array.from(totals, ([id, currentQty]) => ({ itemId: id, currentQty })) };
}
