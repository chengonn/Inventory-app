import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { actor } from "@/lib/moves/service";
import { MoveError } from "@/lib/moves/validation";
import { inventoryId, stockQuery, type StockRow } from "@/lib/inventory/query";
import { parseStocktake, stocktakeDelta } from "./validation";
import { commitStocktakeTransaction } from "./transaction";
export async function loadCountSheet(locationId: number) {
  await actor(false); inventoryId(locationId);
  const db = getPrisma();
  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location?.isActive) throw new MoveError("櫃位不存在或已停用。");
  const [items, stock] = await Promise.all([db.item.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }), db.$queryRaw<StockRow[]>(stockQuery(undefined, locationId))]);
  const quantities = new Map(stock.map((r) => [r.itemId, r.currentQty.toFixed(3)]));
  return { location: `${location.area} / ${location.cabinetNo}`, items: items.map((i) => ({ ...i, current: quantities.get(i.id) ?? "0.000" })) };
}
export async function previewStocktake(form: FormData) {
  await actor(true);
  const input = parseStocktake(form), db = getPrisma();
  const [location, items, stock] = await Promise.all([
    db.location.findUnique({ where: { id: input.locationId } }),
    db.item.findMany({ where: { id: { in: input.lines.map((r) => r.itemId) }, isActive: true } }),
    db.$queryRaw<StockRow[]>(stockQuery(undefined, input.locationId)),
  ]);
  if (!location?.isActive || items.length !== input.lines.length) throw new MoveError("品項或櫃位不存在或已停用。");
  const quantities = new Map(stock.map((r) => [r.itemId, r.currentQty.toFixed(3)]));
  return input.lines.map((r) => {
    const current = quantities.get(r.itemId) ?? "0.000", item = items.find((i) => i.id === r.itemId)!;
    return { ...r, name: item.name, unit: item.unit, current, ...stocktakeDelta(r.actual, current) };
  });
}
export async function confirmStocktake(form: FormData) {
  const user = await actor(true), input = parseStocktake(form);
  return getPrisma().$transaction((tx) => commitStocktakeTransaction(tx, user, input), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 });
}
