import { enforceGuestBudget, lockGuestBudget } from "@/lib/security/guest-budget";
import "server-only";
import { Prisma, type StockMove } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/policy";
import { readLocationStock } from "@/lib/inventory/query";
import { MoveError, type MoveInput, type parseReversal } from "./validation";

/** All future stock mutations (review/import/count) must follow this protocol.
 * ReadCommitted is required: stock is read in a NEW statement AFTER lock wait.
 * Never use session-level locks with a transaction pooler.
 */
export async function lockStockPair(
  tx: Prisma.TransactionClient,
  itemId: number,
  locationId: number,
) {
  // 交易結束自動釋放；transaction pooler 不可使用需要綁定 session 的鎖。
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${itemId}::int, ${locationId}::int)`;
}
export async function lockRequest(
  tx: Prisma.TransactionClient,
  moveNo: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${moveNo}, 0))`;
}
export async function masters(
  tx: Prisma.TransactionClient,
  itemId: number,
  locationId: number,
  requireActive: boolean,
) {
  // SHARE prevents concurrent master deactivation until this transaction ends.
  const items = await tx.$queryRaw<
    { id: number; unit: string | null; isActive: boolean }[]
  >`SELECT id,unit,"isActive" FROM inventory."Item" WHERE id=${itemId} FOR SHARE`;
  const locations = await tx.$queryRaw<
    { id: number; isActive: boolean }[]
  >`SELECT id,"isActive" FROM inventory."Location" WHERE id=${locationId} FOR SHARE`;
  if (!items[0] || !locations[0]) throw new MoveError("找不到品項或櫃位。");
  if (requireActive && (!items[0].isActive || !locations[0].isActive))
    throw new MoveError("品項或櫃位已停用，請重新選擇。");
  return items[0];
}
export function moveReceipt(row: StockMove, replayed = false) {
  return {
    id: row.id,
    moveNo: row.moveNo,
    status: row.status,
    type: row.type,
    normalizedQty: row.normalizedQty?.toFixed(3) ?? null,
    replayed,
  };
}
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function audit(
  tx: Prisma.TransactionClient,
  row: StockMove,
  actor: Actor,
) {
  await tx.auditLog.create({
    data: {
      action: row.type === "REVERSAL" ? "REVERSE" : "CREATE",
      entityType: "StockMove",
      entityId: String(row.id),
      actorEmail: actor.email,
      afterJson: json(row),
    },
  });
}
function samePayload(row: StockMove, input: MoveInput) {
  const fields = [
    "type",
    "itemId",
    "locationId",
    "status",
    "containerType",
    "rawQuantityText",
    "operator",
    "documentNo",
    "note",
  ] as const;
  if (!fields.every((key) => row[key] === input[key])) return false;
  return (
    [
      "normalizedQty",
      "signedQty",
      "containerCount",
      "unitsPerContainer",
      "looseQty",
    ] as const
  ).every((key) => (row[key]?.toFixed(3) ?? null) === input[key]);
}
/** Internal transaction core: callers MUST authenticate and parse input first. */
export async function insertMove(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: MoveInput,
) {
  await lockGuestBudget(tx, actor);
  const { requestId, ...data } = input;
  const moveNo = `MV-${requestId}`;
  await lockRequest(tx, moveNo);
  const existing = await tx.stockMove.findUnique({ where: { moveNo } });
  if (existing) {
    if (!samePayload(existing, input))
      throw new MoveError("此請求編號已用於不同交易，請重新建立交易。");
    return moveReceipt(existing, true);
  }
  await enforceGuestBudget(tx, actor);
  await lockStockPair(tx, input.itemId, input.locationId);
  const item = await masters(tx, input.itemId, input.locationId, true);
  // 必須在取得鎖後用新的 statement 重讀庫存，不能使用預覽或等待鎖之前的數量。
  const current = await readLocationStock(tx, input.itemId, input.locationId);
  if (
    input.signedQty !== null &&
    new Prisma.Decimal(input.signedQty).isNegative() &&
    current.plus(input.signedQty).isNegative()
  )
    throw new MoveError("已確認庫存不足，交易未寫入。請重新預覽。");
  const row = await tx.stockMove.create({
    data: { ...data, moveNo, occurredAt: new Date(), unit: item.unit },
  });
  await audit(tx, row, actor);
  return moveReceipt(row);
}
export async function insertReversal(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: ReturnType<typeof parseReversal>,
) {
  const moveNo = `MV-${input.requestId}`;
  await lockRequest(tx, moveNo);
  const existing = await tx.stockMove.findUnique({ where: { moveNo } });
  if (existing) {
    if (
      existing.type !== "REVERSAL" ||
      existing.reversalOfMoveId !== input.originalId ||
      existing.note !== input.note
    )
      throw new MoveError("此請求編號已用於不同交易。");
    return moveReceipt(existing, true);
  }
  const original = await tx.stockMove.findUnique({
    where: { id: input.originalId },
  });
  if (
    !original ||
    original.status !== "CONFIRMED" ||
    original.signedQty === null ||
    original.type === "REVERSAL" ||
    original.signedQty.isZero()
  )
    throw new MoveError(
      "僅可沖銷非零且已確認的原交易；待確認資料請於 Review 流程處理。",
    );
  await lockStockPair(tx, original.itemId, original.locationId);
  await masters(tx, original.itemId, original.locationId, false);
  if (
    await tx.stockMove.findUnique({ where: { reversalOfMoveId: original.id } })
  )
    throw new MoveError("此交易已沖銷，不可重複沖銷。");
  const signedQty = original.signedQty.negated();
  // 沖銷新增反向紀錄而非刪除歷史；沖銷入庫也可能扣庫存，因此仍須檢查負數。
  const current = await readLocationStock(
    tx,
    original.itemId,
    original.locationId,
  );
  if (signedQty.isNegative() && current.plus(signedQty).isNegative())
    throw new MoveError("沖銷後庫存會小於零，交易未寫入。");
  const row = await tx.stockMove.create({
    data: {
      moveNo,
      type: "REVERSAL",
      status: "CONFIRMED",
      occurredAt: new Date(),
      itemId: original.itemId,
      locationId: original.locationId,
      unit: original.unit,
      normalizedQty: signedQty.abs(),
      signedQty,
      reversalOfMoveId: original.id,
      note: input.note,
    },
  });
  await audit(tx, row, actor);
  return moveReceipt(row);
}
