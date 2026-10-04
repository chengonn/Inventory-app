import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allowedEmail, verifyActor } from "@/lib/auth/policy";
import { LoginForm } from "./form";
import { logout } from "./actions";

export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const result = await verifyActor(await createClient());
  if (result.status === "allowed" && reason !== "logout_failed") redirect("/dashboard");
  const message = !allowedEmail() ? "登入設定尚未完成，請聯絡管理者。"
    : reason === "logout_failed" ? "登出未完成，請重試。"
    : result.status === "forbidden" || reason === "forbidden" ? "此帳號無權使用本系統。"
    : result.status === "unavailable" ? "登入服務暫時無法使用，請稍後再試。"
    : reason === "signed_out" ? "已登出。" : "";
  return <main className="grid min-h-dvh place-items-center px-5 py-10">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <p className="mb-3 text-sm font-medium text-teal-800">庫存管理 V2</p>
      <h1 className="text-2xl font-semibold">登入庫存管理</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">僅限授權帳號使用。忘記密碼請聯絡管理者。</p>
      {message && <p role="status" className="mt-5 text-sm leading-6 text-amber-900">{message}</p>}
      <LoginForm disabled={!allowedEmail()} />
      {(result.status === "forbidden" || reason === "logout_failed") && <form action={logout} className="mt-4"><button className="min-h-11 w-full rounded-xl border border-slate-300">登出目前帳號</button></form>}
    </section>
  </main>;
}
