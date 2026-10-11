"use server";

import { redirect } from "next/navigation";
import { createActionClient } from "@/lib/supabase/server";
import { allowedEmail, verifyActor } from "@/lib/auth/policy";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export async function login(_previous: { error: string }, form: FormData) {
  if (!allowedEmail()) return { error: "登入設定尚未完成，請聯絡管理者。" };
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length === 0 || password.length > 1024) {
    return { error: "請輸入有效的 Email 與密碼。" };
  }
  try {
    await enforceRateLimit("login");
    const client = await createActionClient();
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.status === 429 ? "嘗試次數過多，請稍後再試。" : "無法登入，請確認帳號密碼或稍後再試。" };
    const result = await verifyActor(client);
    if (result.status !== "allowed") {
      await client.auth.signOut({ scope: "local" });
      return { error: result.status === "forbidden" ? "此帳號無權使用本系統。" : "登入驗證失敗，請稍後再試。" };
    }
  } catch (error) { return { error: error instanceof RateLimitError ? error.message : "登入服務暫時無法使用，請稍後再試。" }; }
  // Never accept an untrusted redirect URL or return passwords/tokens to the UI.
  redirect("/dashboard");
}

export async function logout() {
  let failed = false;
  try {
    const client = await createActionClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    failed = Boolean(error);
  } catch { failed = true; }
  redirect(failed ? "/login?reason=logout_failed" : "/login?reason=signed_out");
}
