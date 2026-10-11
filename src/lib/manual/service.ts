import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { actor } from "@/lib/moves/service";
import { getPrisma } from "@/lib/prisma";
import { MoveError } from "@/lib/moves/validation";
import { parseManual } from "./validation";
import { createManualInventory } from "./transaction";

export async function saveManualInventory(form: FormData) {
  const user = await actor(true);
  const input = parseManual(form);
  try {
    return await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
      return createManualInventory(tx, user, input);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (error instanceof MoveError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new MoveError("品項或位置剛被建立，請重新查詢後再試。");
    throw new MoveError("暫時無法儲存，請保留相同資料重試；系統會避免重複新增。");
  }
}
