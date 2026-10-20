import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { actor } from "@/lib/moves/service";
import { stockQuery, type StockRow } from "./query";
import {
  inventoryRows,
  filterInventory,
  searchOptions,
  taipeiDay,
  type SearchParams,
} from "./read-model";

/** Internal read model. Caller supplies a READ ONLY RepeatableRead transaction. */
export async function readOverview(tx: Prisma.TransactionClient, now: Date) {
  const day = taipeiDay(now);
  const [
    items,
    locations,
    stock,
    openingReview,
    moveReview,
    todayIn,
    todayOut,
    recent,
  ] = await Promise.all([
    tx.item.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        safetyStock: true,
        isActive: true,
      },
    }),
    tx.location.findMany({
      select: { id: true, area: true, cabinetNo: true, isActive: true },
    }),
    tx.$queryRaw<StockRow[]>(stockQuery()),
    tx.openingInventory.findMany({
      where: { status: "NEEDS_REVIEW" },
      select: { itemId: true, locationId: true },
    }),
    tx.stockMove.findMany({
      where: { status: "NEEDS_REVIEW" },
      select: { itemId: true, locationId: true },
    }),
    tx.stockMove.count({
      where: {
        status: "CONFIRMED",
        type: "IN",
        occurredAt: { gte: day.start, lt: day.end },
      },
    }),
    tx.stockMove.count({
      where: {
        status: "CONFIRMED",
        type: "OUT",
        occurredAt: { gte: day.start, lt: day.end },
      },
    }),
    tx.stockMove.findMany({
      take: 10,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        moveNo: true,
        type: true,
        status: true,
        signedQty: true,
        occurredAt: true,
        item: { select: { name: true } },
        location: { select: { area: true, cabinetNo: true } },
      },
    }),
  ]);
  const rows = inventoryRows(
    items.map((i) => ({
      ...i,
      safetyStock: i.safetyStock?.toFixed(3) ?? null,
    })),
    locations,
    stock.map((s) => ({
      ...s,
      currentQty: s.currentQty.toFixed(3),
      openingQty: s.openingQty.toFixed(3),
      movementQty: s.movementQty.toFixed(3),
      itemTotalQty: s.itemTotalQty.toFixed(3),
    })),
    [...openingReview, ...moveReview],
  );
  return {
    rows,
    metrics: {
      total: rows.length,
      stocked: rows.filter((r) => r.hasStock).length,
      low: rows.filter((r) => r.low).length,
      review: openingReview.length + moveReview.length,
      todayIn,
      todayOut,
    },
    recent: recent.map((r) => ({
      id: r.id,
      moveNo: r.moveNo,
      type: r.type,
      status: r.status,
      quantity: r.signedQty?.toFixed(3) ?? null,
      at: r.occurredAt.toISOString(),
      item: r.item.name,
      location: `${r.location.area} / ${r.location.cabinetNo}`,
    })),
    asOf: now.toISOString(),
  };
}
async function snapshot() {
  await actor(false);
  return getPrisma().$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return readOverview(tx, new Date());
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5000,
      timeout: 15000,
    },
  );
}
export async function dashboardData() {
  const { metrics, recent, asOf } = await snapshot();
  return { metrics, recent, asOf };
}
export async function browseInventory(params: SearchParams) {
  const options = searchOptions(params),
    data = await snapshot();
  return { ...filterInventory(data.rows, options), options, asOf: data.asOf };
}
