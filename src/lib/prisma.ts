import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { DATABASE_SCHEMA, runtimePoolConfig } from "../../config/database";

const databaseGlobal = globalThis as unknown as { inventoryPrisma?: PrismaClient };

/** Lazy Node-runtime pool. Unlike Auth clients, this contains no user session. */
export function getPrisma() {
  if (!databaseGlobal.inventoryPrisma) {
    const pool = runtimePoolConfig(process.env.DATABASE_URL, process.env.DB_POOL_MAX ?? "2", process.env.DATABASE_SSL_CA);
    const adapter = new PrismaPg(pool, {
      schema: DATABASE_SCHEMA,
      // Do not supply statementNameGenerator: pg must use unnamed statements
      // with Supavisor transaction pooling (adapter-pg 7.10.0 default).
      onPoolError: () => console.error("Database pool unavailable"),
    });
    databaseGlobal.inventoryPrisma = new PrismaClient({ adapter, errorFormat: "minimal", log: [] });
  }
  // Never migrate or disconnect on each request. Services add auth + transaction.
  return databaseGlobal.inventoryPrisma;
}
