import { isGuest } from "@/lib/auth/permissions";
import { GUEST_COOKIE } from "@/lib/auth/guest";
import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-handler";
import { verifyActor } from "@/lib/auth/policy";
import { getPrisma } from "@/lib/prisma";
import { readExport, type ExportKind } from "@/lib/exports/data";
import { exportWorkbook } from "@/lib/exports/workbook";
import { MoveError } from "@/lib/moves/validation";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const authResponse = new NextResponse(null, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
  const respond = (
    body: Uint8Array<ArrayBuffer> | string,
    status: number,
    headers?: Record<string, string>,
  ) => {
    const result = new NextResponse(body, {
      status,
      headers: authResponse.headers,
    });
    authResponse.cookies
      .getAll()
      .forEach((cookie) => result.cookies.set(cookie));
    for (const [key, value] of Object.entries(headers ?? {}))
      result.headers.set(key, value);
    return result;
  };
  try {
    const client = createRouteClient(request, authResponse),
      auth = await verifyActor(
        client,
        request.cookies.get(GUEST_COOKIE)?.value ?? "",
      );
    if (auth.status !== "allowed") {
      if (auth.status === "forbidden")
        await client.auth.signOut({ scope: "local" });
      return respond(
        "無法匯出，請確認登入權限。",
        auth.status === "anonymous"
          ? 401
          : auth.status === "forbidden"
            ? 403
            : 503,
      );
    }
    if (isGuest(auth.actor)) return respond("訪客帳號無法匯出資料。", 403);
    const kind = request.nextUrl.searchParams.get("kind") ?? "inventory";
    if (!["inventory", "moves", "backup"].includes(kind))
      throw new MoveError("匯出種類無效。");
    await enforceRateLimit("export");
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const sheets = await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        return readExport(tx, kind as ExportKind, params);
      },
      { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 30000 },
    );
    const buffer = exportWorkbook(sheets);
    return respond(new Uint8Array(buffer), 200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory-${kind}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    });
  } catch (error) {
    return respond(
      error instanceof MoveError
        ? error.message
        : "匯出服務暫時無法使用，請稍後重試。",
      error instanceof RateLimitError
        ? 429
        : error instanceof MoveError
          ? 400
          : 503,
      {
        "Content-Type": "text/plain; charset=utf-8",
        ...(error instanceof RateLimitError ? { "Retry-After": "60" } : {}),
      },
    );
  }
}
