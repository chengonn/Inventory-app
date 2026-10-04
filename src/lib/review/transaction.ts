import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/policy";
import { lockRequest, lockStockPair, masters } from "@/lib/moves/transaction";
import { readLocationStock } from "@/lib/inventory/query";
import { MoveError } from "@/lib/moves/validation";
import type { ReviewInput } from "./validation";
const json = (data: unknown) => JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
export async function reviewTarget(tx: Prisma.TransactionClient, input: ReviewInput) {
  return input.entity === "OpeningInventory" ? tx.openingInventory.findUnique({ where: { id: input.id } }) : tx.stockMove.findUnique({ where: { id: input.id } });
}
export async function reviewCalculation(tx: Prisma.TransactionClient, input: ReviewInput) {
  const row = await reviewTarget(tx, input);
  if (!row || row.status !== "NEEDS_REVIEW") throw new MoveError("資料不存在或已處理，請重新載入待確認清單。");
  const item = await tx.item.findUniqueOrThrow({ where: { id: row.itemId } });
  if (input.decision === "CONFIRM" && (!item.unit || item.unit === "未註明" || item.unit !== input.unit)) throw new MoveError("請先在品項管理確認標準單位，並以相同單位重新預覽。");
  if ("type" in row && row.type === "REVERSAL") throw new MoveError("沖銷不可透過待確認流程修改。");
  const current = await readLocationStock(tx, row.itemId, row.locationId);
  const signedQty = input.decision === "IGNORE" ? null : "type" in row && ["OUT", "ADJUST_LOSS"].includes(row.type) ? `-${input.normalizedQty}` : input.normalizedQty;
  const after = signedQty === null ? current : current.plus(signedQty);
  if (after.isNegative()) throw new MoveError("已確認庫存不足，確認後會小於零。請先核對期初或入庫。");
  return { row, current: current.toFixed(3), after: after.toFixed(3), signedQty, item: item.name };
}
/** Internal core. Caller must authenticate, parse, use ReadCommitted. */
export async function commitReviewTransaction(tx: Prisma.TransactionClient, actor: Actor, input: ReviewInput) {
  const key = `RV-${input.requestId}`;
  await lockRequest(tx, key);
  const previous = await tx.auditLog.findFirst({ where: { action: "REVIEW", entityType: "ReviewReceipt", entityId: key } });
  if (previous) {
    const saved = previous.afterJson as unknown as { input: ReviewInput; receipt: { entity: string; id: number; status: string; current: string; after: string } };
    if (previous.actorEmail !== actor.email || !Object.keys(input).every((k) => input[k as keyof ReviewInput] === saved.input[k as keyof ReviewInput])) throw new MoveError("此請求編號已用於不同處理內容。");
    return { ...saved.receipt, replayed: true };
  }
  const original = await reviewTarget(tx, input);
  if (!original) throw new MoveError("找不到待確認資料。");
  await lockStockPair(tx, original.itemId, original.locationId);
  await masters(tx, original.itemId, original.locationId, false);
  const result = await reviewCalculation(tx, input); // new statement after lock wait
  const status = input.decision === "CONFIRM" ? "CONFIRMED" : "IGNORED";
  const data = input.decision === "IGNORE" ? { status, normalizedQty: null } : { status, unit: input.unit, normalizedQty: input.normalizedQty, containerType: input.containerType, containerCount: input.containerCount, unitsPerContainer: input.unitsPerContainer, looseQty: input.looseQty };
  const updated = input.entity === "OpeningInventory"
    ? await tx.openingInventory.update({ where: { id: input.id, status: "NEEDS_REVIEW" }, data: { ...data, status } })
    : await tx.stockMove.update({ where: { id: input.id, status: "NEEDS_REVIEW" }, data: { ...data, status, signedQty: result.signedQty } });
  const receipt = { entity: input.entity, id: input.id, status, current: result.current, after: result.after };
  await tx.auditLog.create({ data: { action: "REVIEW", entityType: input.entity, entityId: String(input.id), actorEmail: actor.email, beforeJson: json(result.row), afterJson: json({ row: updated, reason: input.reason, requestId: input.requestId }) } });
  await tx.auditLog.create({ data: { action: "REVIEW", entityType: "ReviewReceipt", entityId: key, actorEmail: actor.email, afterJson: json({ input, receipt }) } });
  return { ...receipt, replayed: false };
}
