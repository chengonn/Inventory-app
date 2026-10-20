import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allowedEmail, verifyActor } from "@/lib/auth/policy";
import { LoginForm } from "./form";
import { logout } from "./actions";
import { publicGuestCredentials } from "@/lib/auth/guest";
import { LanguageSwitcher } from "@/components/language-provider";

export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const t = await getT();

  const { reason } = await searchParams;
  const guest = await publicGuestCredentials();
  const result = await verifyActor(await createClient());
  if (result.status === "allowed" && reason !== "logout_failed")
    redirect("/dashboard");
  const message = !allowedEmail()
    ? t("登入設定尚未完成，請聯絡管理者。")
    : reason === "logout_failed"
      ? t("登出未完成，請重試。")
      : result.status === "forbidden" || reason === "forbidden"
        ? t("此帳號無權使用本系統。")
        : result.status === "unavailable"
          ? t("登入服務暫時無法使用，請稍後再試。")
          : reason === "signed_out"
            ? t("已登出。")
            : "";
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-5 flex justify-end">
          <LanguageSwitcher />
        </div>
        <p className="mb-3 text-sm font-medium text-teal-800">
          {t("庫存管理 V2")}
        </p>
        <h1 className="text-2xl font-semibold">{t("登入庫存管理")}</h1>
        {process.env.INVENTORY_DEMO === "true" && (
          <p className="mt-3 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
            {t(
              "作品展示版。請使用專案作者提供的展示帳號與密碼，登入後可手動建立品項及體驗庫存操作。",
            )}
          </p>
        )}
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {t("僅限授權帳號使用。忘記密碼請聯絡管理者。")}
        </p>
        {message && (
          <p role="status" className="mt-5 text-sm leading-6 text-amber-900">
            {message}
          </p>
        )}
        <LoginForm disabled={!allowedEmail()} guest={guest} />
        {(result.status === "forbidden" || reason === "logout_failed") && (
          <form action={logout} className="mt-4">
            <button className="min-h-11 w-full rounded-xl border border-slate-300">
              {t("登出目前帳號")}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
