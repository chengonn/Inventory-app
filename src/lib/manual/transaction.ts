import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/policy";
import { insertMove, lockRequest, lockStockPair, masters } from "@/lib/moves/transaction";
import { MoveError, parseMove } from "@/lib/moves/validation";
import type { ManualInput } from "./validation";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/** Internal: authenticated, validated callers only; ReadCommitted transaction required. */
export async function createManualInventory(tx: Prisma.TransactionClient, actor: Actor, input: ManualInput) {
  // Serialize this small onboarding workflow, including retries and shared location creation.
  // The normal move/stocktake/import pair-lock protocol still applies below.
  await lockRequest(tx, "manual-inventory-create");
  const fingerprint = createHash("sha256").update(JSON.stringify([actor.id, input])).digest("hex");
  const receipt = await tx.auditLog.findFirst({ where: { entityType: "ManualReceipt", entityId: input.requestId, action: "CREATE" } });
  if (receipt) {
    const saved = receipt.afterJson as { fingerprint?: string; itemId?: number } | null;
    if (saved?.fingerprint !== fingerprint || typeof saved.itemId !== "number") throw new MoveError("此請求已用於其他資料，請重新整理後再新增。");
    return { itemId: saved.itemId, replayed: true };
  }
  if (await tx.item.findUnique({ where: { name: input.name } })) throw new MoveError("品項名稱已存在。補貨請使用入庫；不同單位請建立不同名稱的品項。");
  const item = await tx.item.create({ data: { name: input.name, unit: input.unit, note: input.note } });
  await tx.auditLog.create({ data: { action: "CREATE", entityType: "Item", entityId: String(item.id), actorEmail: actor.email, afterJson: json(item) } });
  let location = await tx.location.findUnique({ where: { area_cabinetNo: { area: input.area, cabinetNo: input.cabinetNo } } });
  if (!location) {
    location = await tx.location.create({ data: { area: input.area, cabinetNo: input.cabinetNo } });
    await tx.auditLog.create({ data: { action: "CREATE", entityType: "Location", entityId: String(location.id), actorEmail: actor.email, afterJson: json(location) } });
  }
  if (!location.isActive) throw new MoveError("此位置已停用，請使用其他位置或先重新啟用。");
  if (input.quantity !== "0.000") {
    const form = new FormData();
    for (const [key, value] of Object.entries({ requestId: input.requestId, itemId: String(item.id), locationId: String(location.id), mode: "direct", quantity: input.quantity, note: input.note ?? "手動建立初始庫存" })) form.set(key, value);
    await insertMove(tx, actor, parseMove("IN", form));
  } else {
    await lockStockPair(tx, item.id, location.id);
    await masters(tx, item.id, location.id, true);
    // An explicit zero opening records this location and known physical zero.
    const opening = await tx.openingInventory.create({ data: { itemId: item.id, locationId: location.id, normalizedQty: "0", unit: input.unit, status: "CONFIRMED", note: input.note ?? "手動建立零庫存" } });
    await tx.auditLog.create({ data: { action: "CREATE", entityType: "OpeningInventory", entityId: String(opening.id), actorEmail: actor.email, afterJson: json(opening) } });
  }
  await tx.auditLog.create({ data: { action: "CREATE", entityType: "ManualReceipt", entityId: input.requestId, actorEmail: actor.email, afterJson: { fingerprint, itemId: item.id } } });
  return { itemId: item.id, replayed: false };
}
