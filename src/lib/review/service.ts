import { requireManager } from "@/lib/auth/permissions";
import "server-only";
import { getPrisma } from "@/lib/prisma";
import { actor } from "@/lib/moves/service";
import { searchOptions, type SearchParams } from "@/lib/inventory/read-model";
import { parseReview } from "./validation";
import { reviewCalculation, commitReviewTransaction } from "./transaction";
export async function reviewQueue(params: SearchParams) {
  requireManager(await actor(false));
  const options = searchOptions(params),
    db = getPrisma();
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const include = {
        item: { select: { name: true, unit: true } },
        location: { select: { area: true, cabinetNo: true } },
      };
      const [openings, moves] = await Promise.all([
        tx.openingInventory.findMany({
          where: { status: "NEEDS_REVIEW" },
          include,
          orderBy: { id: "asc" },
        }),
        tx.stockMove.findMany({
          where: { status: "NEEDS_REVIEW" },
          include,
          orderBy: { id: "asc" },
        }),
      ]);
      const rows = [
        ...openings.map((r) => ({
          ...r,
          entity: "OpeningInventory" as const,
          type: "期初",
          source: `${r.sourceSheet ?? "手動建立"} / ${r.sourceCell ?? "未填"}`,
        })),
        ...moves.map((r) => ({
          ...r,
          entity: "StockMove" as const,
          source: r.note?.match(/Excel [^\n]+/)?.[0] ?? r.moveNo,
        })),
      ].map((r) => ({
        entity: r.entity,
        id: r.id,
        type:
          (
            {
              IN: "入庫",
              OUT: "出庫",
              ADJUST_GAIN: "盤盈",
              ADJUST_LOSS: "盤損",
              REVERSAL: "沖銷",
            } as Record<string, string>
          )[r.type] ?? r.type,
        item: r.item.name,
        unit: r.item.unit,
        location: `${r.location.area} / ${r.location.cabinetNo}`,
        raw: r.rawQuantityText,
        source: r.source,
        note: r.note,
        containerType: r.containerType,
        containerCount: r.containerCount?.toFixed(3) ?? "",
        unitsPerContainer: r.unitsPerContainer?.toFixed(3) ?? "",
        looseQty: r.looseQty?.toFixed(3) ?? "",
        storedUnit: r.unit,
      }));
      const filtered = rows.filter((r) =>
        [r.item, r.location, r.raw ?? ""].some((s) =>
          s.toLowerCase().includes(options.q.toLowerCase()),
        ),
      );
      const pages = Math.max(1, Math.ceil(filtered.length / 20)),
        page = Math.min(options.page, pages);
      return {
        rows: filtered.slice((page - 1) * 20, page * 20),
        page,
        pages,
        total: filtered.length,
        q: options.q,
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 15000 },
  );
}
export async function previewReview(form: FormData) {
  requireManager(await actor(true));
  const input = parseReview(form);
  const result = await getPrisma().$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return reviewCalculation(tx, input);
    },
    { isolationLevel: "RepeatableRead", timeout: 15000 },
  );
  return {
    item: result.item,
    quantity: input.normalizedQty,
    unit: input.unit,
    current: result.current,
    after: result.after,
    decision: input.decision,
  };
}
export async function confirmReview(form: FormData) {
  const user = await actor(true);
  requireManager(user);
  const input = parseReview(form);
  return getPrisma().$transaction(
    (tx) => commitReviewTransaction(tx, user, input),
    { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 15000 },
  );
}
