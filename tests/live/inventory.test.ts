import { afterAll, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runtimePoolConfig } from "../../config/database";
import { stockQuery, readLocationStock, type StockRow } from "../../src/lib/inventory/query";
const db = new PrismaClient({ adapter: new PrismaPg(runtimePoolConfig(process.env.DATABASE_URL, "2", process.env.DATABASE_SSL_CA), { schema: "inventory" }) });
afterAll(async () => db.$disconnect());
it("calculates on the real Supabase pooler and supplied transaction, then rolls back all fixtures", async () => {
  const name = `step6-rollback-${crypto.randomUUID()}`;
  const rollback = new Error("intentional rollback");
  await expect(db.$transaction(async (tx) => {
    const item = await tx.item.create({ data: { name } });
    const one = await tx.location.create({ data: { area: name, cabinetNo: "1" } });
    const two = await tx.location.create({ data: { area: name, cabinetNo: "2", isActive: false } });
    await tx.openingInventory.createMany({ data: [
      { itemId: item.id, locationId: one.id, normalizedQty: "0.100" },
      { itemId: item.id, locationId: one.id, normalizedQty: "0.200" },
      { itemId: item.id, locationId: two.id, normalizedQty: "5" },
      { itemId: item.id, locationId: one.id, normalizedQty: null, status: "NEEDS_REVIEW" },
      { itemId: item.id, locationId: one.id, normalizedQty: "999", status: "IGNORED" },
    ] });
    await tx.stockMove.create({ data: { moveNo: name, occurredAt: new Date(), type: "OUT", itemId: item.id, locationId: one.id, normalizedQty: "0.125", signedQty: "-0.125" } });
    const rows = await tx.$queryRaw<StockRow[]>(stockQuery(item.id));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.currentQty.toFixed(3))).toEqual(["0.175", "5.000"]);
    expect(rows.every((r) => r.itemTotalQty.toFixed(3) === "5.175")).toBe(true);
    expect((await readLocationStock(tx, item.id, one.id)).toFixed(3)).toBe("0.175");
    throw rollback;
  }, { timeout: 20000 })).rejects.toBe(rollback);
  expect(await db.item.count({ where: { name } })).toBe(0);
  expect(await db.stockMove.count({ where: { moveNo: name } })).toBe(0);
});
