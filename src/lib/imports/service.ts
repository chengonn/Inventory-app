import { requireManager } from "@/lib/auth/permissions";
import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { actor } from "@/lib/moves/service";
import { MoveError } from "@/lib/moves/validation";
import { getPrisma } from "@/lib/prisma";
import { counts, MAX_FILE_BYTES } from "./model";
import { parseWorkbook } from "./parse";
import { commitImportTransaction, inspectImport, json } from "./transaction";
import { requireLegacyImport } from "./policy";

export async function previewImport(form: FormData) {
  const user = await actor(true);
  requireManager(user);
  requireLegacyImport();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_BYTES)
    throw new MoveError("請選擇 3 MB 以內的 .xlsx 檔案。");
  const plan = parseWorkbook(Buffer.from(await file.arrayBuffer()), file.name);
  return getPrisma().$transaction(
    async (tx) => {
      const check = await inspectImport(tx, plan);
      const token = check.issues.some((i) => i.level === "error")
        ? null
        : randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      if (token)
        await tx.auditLog.create({
          data: {
            action: "IMPORT_PREVIEW",
            entityType: "ImportPreview",
            entityId: token,
            actorEmail: user.email,
            afterJson: json({ userId: user.id, expiresAt, plan }),
          },
        });
      const moves = new Map(plan.moves.map((r) => [r.row, r])),
        archives = new Map(plan.archives.map((r) => [r.row, r]));
      return {
        token,
        expiresAt,
        fileName: plan.fileName,
        fileHash: plan.fileHash,
        counts: counts(plan),
        issues: check.issues,
        duplicate: check.duplicate,
        items: plan.items,
        rows: [...plan.openings, ...plan.moves, ...plan.archives].map((r) => ({
          source: `${r.sourceSheet}!A${r.row}`,
          originalSource: r.sourceCell,
          itemName: r.itemName,
          location: `${r.area ?? ""} / ${r.cabinetNo ?? ""}`,
          quantity: r.normalizedQty,
          unit: r.unit,
          status: r.sourceSheet === "移除紀錄" ? "ARCHIVED" : r.status,
          raw: r.rawQuantityText,
          note: r.note,
          type: r.sourceSheet === "StockMoves" ? moves.get(r.row)!.type : null,
          occurredAt:
            r.sourceSheet === "StockMoves"
              ? moves.get(r.row)!.occurredAt
              : null,
          signedQty:
            r.sourceSheet === "StockMoves" ? moves.get(r.row)!.signedQty : null,
          removalReason:
            r.sourceSheet === "移除紀錄"
              ? archives.get(r.row)!.removalReason
              : null,
        })),
        effects: check.effects,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5000,
      timeout: 15000,
    },
  );
}
export async function confirmImport(form: FormData) {
  const user = await actor(true);
  requireManager(user);
  requireLegacyImport();
  const token = form.get("token");
  if (
    typeof token !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      token,
    ) ||
    form.get("confirmed") !== "yes"
  )
    throw new MoveError("請先預覽並勾選確認。");
  return getPrisma().$transaction(
    (tx) => commitImportTransaction(tx, user, token),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 10000,
      timeout: 60000,
    },
  );
}
export async function importHistory() {
  requireManager(await actor(false));
  const rows = await getPrisma().importBatch.findMany({
    orderBy: [{ importedAt: "desc" }, { id: "desc" }],
    take: 20,
  });
  return rows.map((r) => ({ ...r, importedAt: r.importedAt.toISOString() }));
}
