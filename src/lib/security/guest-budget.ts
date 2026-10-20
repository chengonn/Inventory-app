import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/policy";
import { MoveError } from "@/lib/moves/validation";

// 必須先於其他業務鎖取得；三種訪客寫入流程共用同一容量鎖。
// 不刪除交易或收據；額度用盡由管理者處理，不因等待下一分鐘而無限成長。
export async function lockGuestBudget(
  tx: Prisma.TransactionClient,
  actor: Actor,
) {
  if (actor.role === "guest")
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('guest-capacity', 0))`;
}

export async function enforceGuestBudget(
  tx: Prisma.TransactionClient,
  actor: Actor,
  createItem = false,
) {
  if (actor.role !== "guest") return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('guest-capacity', 0))`;
  if (
    (await tx.auditLog.count({ where: { actorEmail: actor.email } })) >= 2000 ||
    (createItem && (await tx.item.count()) >= 200)
  ) {
    throw new MoveError("展示資料已達容量上限，請聯絡專案作者；目前仍可查詢。");
  }
}
