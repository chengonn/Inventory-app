import "server-only";
import { createActionClient, createClient } from "@/lib/supabase/server";
import { verifyActor } from "@/lib/auth/policy";
import { getPrisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { masterKind, MasterDataError, parseIdentity, parseMaster, type MasterKind } from "./validation";

async function actor(writable: boolean) {
  const result = await verifyActor(await (writable ? createActionClient() : createClient()));
  if (result.status !== "allowed" || !result.actor) throw new MasterDataError("沒有操作權限或登入已失效，請重新登入。");
  return result.actor;
}
export async function listMasters(kind: MasterKind, search: string, status: string, page: number) {
  await actor(false);
  masterKind(kind);
  const q = search.trim().slice(0, 200);
  const active = status === "all" ? {} : { isActive: status !== "inactive" };
  const db = getPrisma();
  const skip = (Math.max(1, Math.min(page, 100000)) - 1) * 50;
  const where = kind === "items" ? { ...active, name: { contains: q, mode: "insensitive" as const } }
    : { ...active, OR: ["area", "cabinetNo", "displayName"].map((key) => ({ [key]: { contains: q, mode: "insensitive" as const } })) };
  const rows = kind === "items" ? await db.item.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip, take: 51 })
    : await db.location.findMany({ where, orderBy: [{ area: "asc" }, { cabinetNo: "asc" }, { id: "asc" }], skip, take: 51 });
  return { hasNext: rows.length > 50, rows: rows.slice(0, 50).map((r) => ({
    id: String(r.id), version: r.updatedAt.toISOString(), isActive: String(r.isActive), note: r.note ?? "",
    ...("name" in r ? { name: r.name, unit: r.unit ?? "", safetyStock: r.safetyStock?.toString() ?? "" }
      : { area: r.area, cabinetNo: r.cabinetNo, displayName: r.displayName ?? "" }),
  })) };
}

export async function saveMaster(kindValue: string, form: FormData) {
  const currentActor = await actor(true); // Authorize before any DB access.
  const kind = masterKind(kindValue);
  const identity = parseIdentity(form);
  const data = parseMaster(kind, form);
  const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  try {
    await getPrisma().$transaction(async (tx) => {
      const before = identity ? (kind === "items" ? await tx.item.findUnique({ where: { id: identity.id } }) : await tx.location.findUnique({ where: { id: identity.id } })) : null;
      if (identity && !before) throw new MasterDataError("找不到此主檔，請重新整理。");
      let after;
      if ("name" in data) {
        if (identity) {
          const changed = await tx.item.updateMany({ where: identity, data });
          if (changed.count !== 1) throw new MasterDataError("資料已被更新，請重新整理後再修改。");
          after = await tx.item.findUniqueOrThrow({ where: { id: identity.id } });
        } else after = await tx.item.create({ data });
      } else {
        if (identity) {
          const changed = await tx.location.updateMany({ where: identity, data });
          if (changed.count !== 1) throw new MasterDataError("資料已被更新，請重新整理後再修改。");
          after = await tx.location.findUniqueOrThrow({ where: { id: identity.id } });
        } else after = await tx.location.create({ data });
      }
      await tx.auditLog.create({ data: { action: identity ? "UPDATE" : "CREATE", entityType: kind === "items" ? "Item" : "Location", entityId: String(after.id), actorEmail: currentActor.email, beforeJson: before ? json(before) : Prisma.DbNull, afterJson: json(after) } });
    });
  } catch (error) {
    if (error instanceof MasterDataError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new MasterDataError(kind === "items" ? "品項名稱已存在；若已停用，請重新啟用原品項。" : "此區域與櫃號已存在。");
    throw new MasterDataError("儲存失敗，請稍後再試。");
  }
}
