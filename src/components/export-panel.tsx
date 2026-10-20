import { getT } from "@/lib/i18n/server";
import { ExportButton } from "./export-button";
export async function ExportPanel() {
  const t = await getT();

  return (
    <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">{t("Excel 匯出與備份")}</h2>
      <p className="text-sm text-slate-600">
        {t(
          "完整備份保留主檔、期初、異動、待確認、移除歷史、audit 與匯入批次。數量以文字保留精度，日期為 UTC。備份供追溯與管理員還原，不能直接當作初始匯入範本。",
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <ExportButton
          href="/api/export?kind=inventory"
          fileName="inventory-current.xlsx"
        >
          {t("匯出庫存現況")}
        </ExportButton>
        <ExportButton
          href="/api/export?kind=moves"
          fileName="inventory-moves.xlsx"
        >
          {t("匯出全部異動")}
        </ExportButton>
        <ExportButton
          href="/api/export?kind=backup"
          fileName="inventory-backup.xlsx"
        >
          {t("下載完整 Excel 備份")}
        </ExportButton>
      </div>
      <p className="text-xs text-slate-500">
        {t(
          "上限 10000 列／4 MB；超限會拒絕，不截斷資料。需要篩選請至庫存查詢或異動紀錄頁。資料庫備份與 PITR 仍須依",
        )}{" "}
        <a
          href="https://supabase.com/docs/guides/platform/backups"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {t("Supabase 目前方案")}
        </a>
        {t("確認。")}
      </p>
    </section>
  );
}
