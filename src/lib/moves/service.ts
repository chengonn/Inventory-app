import "server-only";
import { mutationsBlocked } from "@/lib/deployment";
import { Prisma } from "@/generated/prisma/client";
import { createActionClient, createClient } from "@/lib/supabase/server";
import { verifyActor } from "@/lib/auth/policy";
import { getPrisma } from "@/lib/prisma";
import { readLocationStock } from "@/lib/inventory/query";
import { insertMove, insertReversal } from "./transaction";
import { MoveError, parseMove, parseReversal } from "./validation";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function actor(write: boolean) {
  if (write && mutationsBlocked()) throw new MoveError("此環境僅供查詢，已停用庫存與主檔寫入。");
  const result = await verifyActor(await (write ? createActionClient() : createClient()));
  if (result.status !== "allowed" || !result.actor) throw new MoveError("登入已失效或沒有交易權限，請重新登入。");
  if (write) await enforceRateLimit("write");
  return result.actor;
}
export async function moveOptions() {
  await actor(false);
  const db = getPrisma();
  const [items, locations] = await Promise.all([
    db.item.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
    db.location.findMany({ where: { isActive: true }, orderBy: [{ area: "asc" }, { cabinetNo: "asc" }], select: { id: true, area: true, cabinetNo: true } }),
  ]);
  return { items, locations };
}
export async function previewMove(kind: string, form: FormData) {
  await actor(true);
  const input = parseMove(kind, form);
  const db = getPrisma();
  const [item, location] = await Promise.all([db.item.findUnique({ where: { id: input.itemId } }), db.location.findUnique({ where: { id: input.locationId } })]);
  if (!item?.isActive || !location?.isActive) throw new MoveError("品項或櫃位不存在或已停用。");
  const current = await readLocationStock(db, input.itemId, input.locationId);
  const after = input.signedQty === null ? current : current.plus(input.signedQty);
  if (input.type === "OUT" && after.isNegative()) throw new MoveError("已確認庫存不足，請減少出庫數量。");
  return { item: item.name, location: `${location.area} / ${location.cabinetNo}`, unit: item.unit, quantity: input.normalizedQty, status: input.status, current: current.toFixed(3), after: after.toFixed(3) };
}
const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 };
export async function commitMove(kind: string, form: FormData) {
  const currentActor = await actor(true);
  const input = parseMove(kind, form);
  return getPrisma().$transaction((tx) => insertMove(tx, currentActor, input), transactionOptions);
}
export async function reverseMove(form: FormData) {
  const currentActor = await actor(true);
  const input = parseReversal(form);
  return getPrisma().$transaction((tx) => insertReversal(tx, currentActor, input), transactionOptions);
}
export async function recentMoves() {
  await actor(false);
  const rows = await getPrisma().stockMove.findMany({ take: 50, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { item: { select: { name: true } }, location: { select: { area: true, cabinetNo: true } }, reversedByMove: { select: { id: true } } } });
  return rows.map((r) => ({ id: r.id, moveNo: r.moveNo, type: r.type, status: r.status, item: r.item.name, location: `${r.location.area} / ${r.location.cabinetNo}`, signedQty: r.signedQty?.toFixed(3) ?? null, at: r.occurredAt.toISOString(), canReverse: r.status === "CONFIRMED" && r.type !== "REVERSAL" && !!r.signedQty && !r.signedQty.isZero() && !r.reversedByMove }));
}
