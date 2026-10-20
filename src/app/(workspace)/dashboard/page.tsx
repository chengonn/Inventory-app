import { getT, getLocale } from "@/lib/i18n/server";
import Link from "next/link";
import { dashboardData } from "@/lib/inventory/browse";
import { InventorySearch } from "@/components/inventory-search";
import { quickActions } from "@/lib/navigation";
const types = {
  IN: "入庫",
  OUT: "出庫",
  ADJUST_GAIN: "盤盈",
  ADJUST_LOSS: "盤損",
  REVERSAL: "沖銷",
};
export default async function Dashboard() {
  const t = await getT();
  const locale = await getLocale();

  let data: Awaited<ReturnType<typeof dashboardData>>;
  try {
    data = await dashboardData();
  } catch {
    return (
      <>
        <h1 className="text-2xl font-semibold">{t("工作總覽")}</h1>
        <p role="alert" className="my-5">
          {t("暫時無法讀取總覽，請重新整理或重新登入。")}
        </p>
      </>
    );
  }
  const stats = [
    [t("品項總數"), data.metrics.total],
    [t("有庫存品項數"), data.metrics.stocked],
    [t("低於安全庫存品項數"), data.metrics.low],
    [t("待確認筆數"), data.metrics.review],
    [t("今日入庫筆數"), data.metrics.todayIn],
    [t("今日出庫筆數"), data.metrics.todayOut],
  ] as const;
  return (
    <>
      <h1 className="text-3xl font-semibold">{t("工作總覽")}</h1>
      <InventorySearch />
      <section
        aria-label={t("庫存統計")}
        className="grid grid-cols-2 gap-3 xl:grid-cols-3"
      >
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-sm text-slate-600">{label}</h2>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
            {label === t("低於安全庫存品項數") && (
              <Link
                href="/inventory?low=1"
                className="mt-3 block min-h-11 py-2 text-sm text-teal-900 underline"
              >
                {t("查看低庫存")}
              </Link>
            )}
          </div>
        ))}
      </section>
      <p className="mt-4 text-sm text-slate-500">
        {t(
          "包含停用品項與櫃位歷史。有庫存＝已確認總量大於零；今日筆數只計台北時間當日的已確認 IN／OUT，沖銷另列歷史。",
        )}
      </p>
      <section
        aria-label={t("快速操作")}
        className="my-7 grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {quickActions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="min-h-11 rounded-xl bg-teal-900 p-5 text-white"
          >
            {t(a.label)}
          </Link>
        ))}
      </section>
      <section aria-label={t("最近異動")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("最近 10 筆異動")}</h2>
          <Link href="/moves" className="min-h-11 py-2 text-sm underline">
            {t("全部異動")}
          </Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.recent.map((r) => (
            <article
              key={r.id}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"
            >
              <h3 className="font-semibold">
                {t(types[r.type])} · {r.item}
              </h3>
              <p>
                {r.location} · {r.quantity ?? t("未知數量")}
              </p>
              <p className="text-sm">
                {r.status === "CONFIRMED"
                  ? t("已確認")
                  : r.status === "NEEDS_REVIEW"
                    ? t("待確認（不計庫存）")
                    : t("已忽略")}
              </p>
              <p className="break-all text-xs text-slate-500">{r.moveNo}</p>
              <time className="text-xs text-slate-500">
              {new Date(r.at).toLocaleString(locale, {
                  timeZone: "Asia/Taipei",
                })}
              </time>
            </article>
          ))}
        </div>
        {!data.recent.length && <p>{t("尚無異動紀錄。")}</p>}
      </section>
      <p className="mt-6 text-xs text-slate-500">
        {t("讀取時間：")}
        {new Date(data.asOf).toLocaleString(locale, {
          timeZone: "Asia/Taipei",
        })}
        {t("（台北）")}
      </p>
    </>
  );
}
