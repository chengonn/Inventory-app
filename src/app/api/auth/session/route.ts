import { GUEST_COOKIE } from "@/lib/auth/guest";
import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-handler";
import { verifyActor } from "@/lib/auth/policy";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  // Keep the same response so refresh/sign-out cookies are retained.
  const response = new NextResponse(null, {
    headers: { "Cache-Control": "private, no-store" },
  });
  try {
    const client = createRouteClient(request, response);
    const result = await verifyActor(
      client,
      request.cookies.get(GUEST_COOKIE)?.value ?? "",
    );
    if (result.status === "forbidden")
      await client.auth.signOut({ scope: "local" });
    const status = {
      allowed: 204,
      anonymous: 401,
      forbidden: 403,
      unavailable: 503,
    }[result.status];
    return withStatus(response, status);
  } catch {
    return withStatus(response, 503);
  }
}

function withStatus(previous: NextResponse, status: number) {
  const result = new NextResponse(null, { status, headers: previous.headers });
  previous.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
  return result;
}
