import "server-only";
import { actor } from "./service";
import { getPrisma } from "@/lib/prisma";
import { searchOptions, type SearchParams } from "@/lib/inventory/read-model";
import { moveFilters, moveFilterQuery } from "./filter";
export async function browseMoves(params: SearchParams) {
  await actor(false);
  const filters = moveFilters(params), requested = searchOptions(params).page;
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const total = await tx.stockMove.count({ where: filters.where }), pages = Math.max(1, Math.ceil(total / 50)), page = Math.min(requested, pages);
    const rows = await tx.stockMove.findMany({ where: filters.where, skip: (page - 1) * 50, take: 50, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], include: { item: { select: { name: true } }, location: { select: { area: true, cabinetNo: true } }, reversedByMove: { select: { id: true } } } });
    return { rows: rows.map((r) => ({ id: r.id, moveNo: r.moveNo, type: r.type, status: r.status, item: r.item.name, location: `${r.location.area} / ${r.location.cabinetNo}`, signedQty: r.signedQty?.toFixed(3) ?? null, at: r.occurredAt.toISOString(), canReverse: r.status === "CONFIRMED" && r.type !== "REVERSAL" && !!r.signedQty && !r.signedQty.isZero() && !r.reversedByMove })), total, page, pages, query: moveFilterQuery(filters), filters: { q: filters.q, type: filters.type, status: filters.status, from: filters.from, to: filters.to } };
  }, { isolationLevel: "RepeatableRead", timeout: 15000 });
}
