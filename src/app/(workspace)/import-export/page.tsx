import { getT, getLocale } from "@/lib/i18n/server";
import { requireManagerPage } from "@/lib/auth/guard";
import { ExportPanel } from "@/components/export-panel";
import { ImportForm } from "@/components/import-form";
import { importHistory } from "@/lib/imports/service";
import { legacyImportEnabled } from "@/lib/imports/policy";
export const runtime = "nodejs";
export const maxDuration = 60;
export default async function ImportPage() {
  const t = await getT();
  const locale = await getLocale();

  await requireManagerPage();
  if (!legacyImportEnabled())
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{t("匯出備份")}</h1>
        <p>{t("下載庫存與歷史紀錄。新增資料請使用「新增品項與庫存」。")}</p>
        <ExportPanel />
      </div>
    );
  let history: Awaited<ReturnType<typeof importHistory>>;
  try {
    history = await importHistory();
  } catch {
    return (
      <p role="alert">
        {t("無法載入匯入紀錄，請確認登入與資料庫連線後重試。")}
      </p>
    );
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("Excel 匯入／匯出")}</h1>
      <ExportPanel />
      <ImportForm />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("最近 20 次匯入")}</h2>
        {!history.length && <p>{t("尚無匯入紀錄。")}</p>}
        {history.map((r) => (
          <article key={r.id} className="rounded-xl border bg-white p-4">
            <h3 className="break-all font-medium">
              {t("批次")}
              {r.id}：{r.fileName}
            </h3>
            <p className="text-sm">
              {new Date(r.importedAt).toLocaleString(locale, {
                timeZone: "Asia/Taipei",
              })}{" "}
              {t("· 品項")}
              {r.itemCount}
              {t("· 期初")}
              {r.inventoryCount}
              {t("· 異動")} {r.moveCount}
              {t("· 待確認")}
              {r.reviewCount}
            </p>
            <p className="break-all text-xs text-slate-500">
              SHA-256：{r.fileHash}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
