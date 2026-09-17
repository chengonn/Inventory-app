import { afterEach, expect, it, vi } from "vitest";
import { PrismaClient, Prisma } from "../../src/generated/prisma/client";
import { getPrisma } from "../../src/lib/prisma";

afterEach(async () => {
  const state = globalThis as unknown as { inventoryPrisma?: PrismaClient };
  await state.inventoryPrisma?.$disconnect();
  delete state.inventoryPrisma;
  vi.unstubAllEnvs();
});

it("constructs the actual generated Prisma 7 client/pg adapter without a DB connection", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://postgres.testref:fixture@aws-0-test.pooler.supabase.com:6543/postgres");
  vi.stubEnv("DIRECT_URL", "must-not-be-consumed-by-runtime");
  const prisma = getPrisma();
  // Assert scalar facts: passing Prisma's proxy into Vitest's pretty-printer
  // causes recursive property inspection rather than testing the client.
  expect(prisma.$connect).toBeTypeOf("function");
  expect(prisma === getPrisma()).toBe(true);
  expect(prisma.stockMove.findMany).toBeTypeOf("function");
  expect(prisma.openingInventory.findMany).toBeTypeOf("function");
  expect(new Prisma.Decimal("0.1").plus("0.2").toString()).toBe("0.3");
  // No $connect/query: this is package integration, not Supabase verification.
});

