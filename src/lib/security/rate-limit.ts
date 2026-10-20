import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { MoveError } from "@/lib/moves/validation";

const limits = { login: 10, write: 60, export: 5 } as const;
// 每分鐘全站共用額度，刻意符合單帳號展示用途，並非每位訪客各有一份額度。
export type RateScope = keyof typeof limits;
export class RateLimitError extends MoveError {}

/** Database time and an atomic UPSERT work across serverless instances.
 * Fixed per-app scopes deliberately match this single-account application.
 * No untrusted IP headers; three rows maximum; counters saturate at limit+1.
 */
export function bucketQuery(scope: RateScope) {
  const limit = limits[scope];
  return Prisma.sql`
    INSERT INTO inventory."RateLimitBucket" AS bucket (scope, "windowStart", count)
    VALUES (${scope}, date_trunc('minute', statement_timestamp()), 1)
    ON CONFLICT (scope) DO UPDATE SET
      "windowStart" = GREATEST(bucket."windowStart", EXCLUDED."windowStart"),
      count = CASE WHEN bucket."windowStart" >= EXCLUDED."windowStart"
        THEN LEAST(bucket.count + 1, ${limit + 1}) ELSE 1 END
    RETURNING count <= ${limit} AS allowed`;
}

export async function enforceRateLimit(scope: RateScope) {
  const rows = await getPrisma().$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '2s'`;
      return tx.$queryRaw<{ allowed: boolean }[]>(bucketQuery(scope));
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 2000,
      timeout: 4000,
    },
  );
  // 必須在 commit 後才回報超額，否則 rollback 會讓拒絕的請求不被計數。
  if (rows[0]?.allowed !== true)
    throw new RateLimitError("操作次數過多，請等候一分鐘再試。");
}
