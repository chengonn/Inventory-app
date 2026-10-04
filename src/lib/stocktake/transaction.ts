import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/policy";
import { lockRequest, lockStockPair, masters } from "@/lib/moves/transaction";
import { MoveError } from "@/lib/moves/validation";
import { readLocationStock } from "@/lib/inventory/query";
import { stocktakeDelta, type StocktakeInput } from "./validation";
export type CountResult = { itemId: number; current: string; actual: string; signedQty: string; type: "ADJUST_GAIN" | "ADJUST_LOSS" | null; moveId: number | null };
export type CountReceipt = { requestId: string; rows: CountResult[]; replayed: boolean };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
/** Internal core; caller must authenticate, parse, and use ReadCommitted. */
export async function commitStocktakeTransaction(tx: Prisma.TransactionClient, actor: Actor, input: StocktakeInput): Promise<CountReceipt> {
  const key = `ST-${input.requestId}`;
  await lockRequest(tx, key);
  // Receipt persists even for a zero-difference count, preventing a retry from
  // resetting stock after a later IN/OUT. No zero-quantity StockMove is created.
  const existing = await tx.auditLog.findFirst({ where: { entityType: "Stocktake", entityId: key, action: "STOCKTAKE" } });
  if (existing) {
    const stored = existing.afterJson as unknown as { input: StocktakeInput; receipt: CountReceipt };
    if (stored.input.requestId !== input.requestId || stored.input.locationId !== input.locationId || stored.input.note !== input.note || stored.input.lines.length !== input.lines.length || !stored.input.lines.every((r, i) => r.itemId === input.lines[i].itemId && r.actual === input.lines[i].actual)) throw new MoveError("此盤點請求已用於不同內容，請建立新盤點。");
    return { ...stored.receipt, replayed: true };
  }
  const lines = [...input.lines].sort((a, b) => a.itemId - b.itemId);
  for (const line of lines) await lockStockPair(tx, line.itemId, input.locationId);
  const rows: CountResult[] = [];
  for (const line of lines) {
    const item = await masters(tx, line.itemId, input.locationId, true);
    const current = (await readLocationStock(tx, line.itemId, input.locationId)).toFixed(3);
    const delta = stocktakeDelta(line.actual, current);
    let moveId: number | null = null;
    if (delta.type) {
      const move = await tx.stockMove.create({ data: { moveNo: `${key}-${line.itemId}`, occurredAt: new Date(), itemId: line.itemId, locationId: input.locationId, type: delta.type, status: "CONFIRMED", normalizedQty: delta.normalizedQty, signedQty: delta.signedQty, unit: item.unit, note: input.note } });
      moveId = move.id;
      await tx.auditLog.create({ data: { action: "CREATE", entityType: "StockMove", entityId: String(move.id), actorEmail: actor.email, beforeJson: { currentQty: current }, afterJson: json({ ...move, actualQty: line.actual, stocktakeRequestId: key }) } });
    }
    rows.push({ itemId: line.itemId, current, actual: line.actual, signedQty: delta.signedQty, type: delta.type, moveId });
  }
  const receipt: CountReceipt = { requestId: input.requestId, rows, replayed: false };
  await tx.auditLog.create({ data: { action: "STOCKTAKE", entityType: "Stocktake", entityId: key, actorEmail: actor.email, beforeJson: json(rows.map((r) => ({ itemId: r.itemId, currentQty: r.current }))), afterJson: json({ input, receipt }) } });
  return receipt;
}
