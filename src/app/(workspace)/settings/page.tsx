import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { requirePageActor } from "@/lib/auth/guard";
import { mutationsBlocked } from "@/lib/deployment";

export default async function SettingsPage() {
  const t = await getT();

  const actor = await requirePageActor();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("帳號與使用說明")}</h1>
      <section className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">{t("目前帳號")}</h2>
        <p className="break-all">{actor.email}</p>
        <p>
          {process.env.INVENTORY_DEMO === "true"
            ? t("作品展示環境，請只使用虛構資料。")
            : t("私人庫存工作空間。")}
        </p>
        <p>
          {mutationsBlocked()
            ? t("目前僅供查詢，無法修改資料。")
            : t("可新增品項及操作入庫、出庫與盤點。")}
        </p>
        <p className="text-sm text-slate-600">
          {t(
            "帳號與密碼由專案作者管理。若共用同一帳號，異動紀錄無法區分實際操作者。",
          )}
        </p>
      </section>
      <section className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">{t("如何開始")}</h2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <Link href="/inventory/new" className="underline">
              {t("新增品項與庫存")}
            </Link>
            {t("：填寫名稱、數量、單位與位置。")}
          </li>
          <li>{t("補貨使用入庫、領用使用出庫、核對實際數量使用盤點。")}</li>
          <li>
            {actor.role === "guest"
              ? t("交易錯誤請聯絡專案作者；訪客無法沖銷或管理其他資料。")
              : t("交易錯誤請到異動紀錄沖銷，保留可追溯的歷史。")}
          </li>
        </ol>
        <p className="text-sm text-slate-600">
          {t("建立後不可直接變更單位；不同單位請另建品項。")}
        </p>
      </section>
    </div>
  );
}
