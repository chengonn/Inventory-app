import { afterAll, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runtimePoolConfig } from "../../config/database";
const state = vi.hoisted(() => ({ tx: null as unknown }));
// Auth boundaries are covered separately. This suite tests the real service SQL
// inside an outer transaction that ALWAYS rolls back, including its AuditLogs.
vi.mock("../../src/lib/supabase/server", () => ({ createActionClient: async () => ({}) }));
vi.mock("../../src/lib/auth/policy", () => ({ verifyActor: async () => ({ status: "allowed", actor: { id: "rollback-test", email: "rollback-test@example.invalid" } }) }));
vi.mock("../../src/lib/prisma", () => ({ getPrisma: () => ({ $transaction: (fn: (tx: unknown) => unknown) => fn(state.tx) }) }));
import { saveMaster } from "../../src/lib/master-data/service";
const db = new PrismaClient({ adapter: new PrismaPg(runtimePoolConfig(process.env.DATABASE_URL, "2", process.env.DATABASE_SSL_CA), { schema: "inventory" }) });
afterAll(async () => db.$disconnect());
const rollback = new Error("intentional rollback");
function form(fields: Record<string, string>) { const f = new FormData(); for (const [key, value] of Object.entries(fields)) f.set(key, value); return f; }
it("creates, edits, deactivates and reactivates both master types atomically without leaving data", async () => {
  const name = `step5-rollback-${crypto.randomUUID()}`;
  await expect(db.$transaction(async (tx: Prisma.TransactionClient) => {
    state.tx = tx;
    await saveMaster("items", form({ name, isActive: "true", safetyStock: "0.125" }));
    let item = await tx.item.findUniqueOrThrow({ where: { name } });
    expect(item.safetyStock?.toString()).toBe("0.125");
    const staleVersion = item.updatedAt.toISOString();
    await saveMaster("items", form({ id: String(item.id), version: staleVersion, name, isActive: "false", safetyStock: "0" }));
    item = await tx.item.findUniqueOrThrow({ where: { name } });
    expect(item.isActive).toBe(false);
    await expect(saveMaster("items", form({ id: String(item.id), version: "2000-01-01T00:00:00Z", name, isActive: "true" }))).rejects.toThrow("資料已被更新");
    await saveMaster("items", form({ id: String(item.id), version: item.updatedAt.toISOString(), name, isActive: "true" }));
    expect((await tx.item.findUniqueOrThrow({ where: { name } })).isActive).toBe(true);
    await saveMaster("locations", form({ area: name, cabinetNo: "01", isActive: "true" }));
    let location = await tx.location.findUniqueOrThrow({ where: { area_cabinetNo: { area: name, cabinetNo: "01" } } });
    await saveMaster("locations", form({ id: String(location.id), version: location.updatedAt.toISOString(), area: name, cabinetNo: "02", displayName: "測試櫃", isActive: "false" }));
    location = await tx.location.findUniqueOrThrow({ where: { id: location.id } });
    expect(location.cabinetNo).toBe("02"); expect(location.isActive).toBe(false);
    await saveMaster("locations", form({ id: String(location.id), version: location.updatedAt.toISOString(), area: name, cabinetNo: "02", isActive: "true" }));
    const audits = await tx.auditLog.findMany({ where: { OR: [{ entityType: "Item", entityId: String(item.id) }, { entityType: "Location", entityId: String(location.id) }] } });
    expect(audits).toHaveLength(6);
    expect(audits.every((r) => r.actorEmail === "rollback-test@example.invalid")).toBe(true);
    throw rollback;
  }, { timeout: 20000 })).rejects.toBe(rollback);
  expect(await db.item.count({ where: { name } })).toBe(0);
  expect(await db.location.count({ where: { area: name } })).toBe(0);
  state.tx = null;
});
