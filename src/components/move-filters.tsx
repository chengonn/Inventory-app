import { getT } from "@/lib/i18n/server";
import { ExportButton } from "./export-button";
export async function MoveFilters({
  filters,
  query,
  canExport = true,
}: {
  filters: {
    q: string;
    type: string;
    status: string;
    from: string;
    to: string;
  };
  query: string;
  canExport?: boolean;
}) {
  const t = await getT();

  const field =
    "block min-h-11 w-full min-w-0 rounded border border-slate-300 p-2";
  return (
    <>
      <form className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label>
          {t("搜尋品項、位置或單號")}
          <input
            name="q"
            maxLength={100}
            defaultValue={filters.q}
            className={field}
          />
        </label>
        <label>
          {t("異動類型")}
          <select name="type" defaultValue={filters.type} className={field}>
            <option value="">{t("全部")}</option>
            {Object.entries({
              IN: t("入庫"),
              OUT: t("出庫"),
              ADJUST_GAIN: t("盤盈"),
              ADJUST_LOSS: t("盤損"),
              REVERSAL: t("沖銷"),
            }).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("資料狀態")}
          <select name="status" defaultValue={filters.status} className={field}>
            <option value="">{t("全部")}</option>
            <option value="CONFIRMED">{t("已確認")}</option>
            <option value="NEEDS_REVIEW">{t("待確認")}</option>
            <option value="IGNORED">{t("已忽略")}</option>
          </select>
        </label>
        <label>
          {t("開始日期（台北）")}
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className={field}
          />
        </label>
        <label>
          {t("結束日期（台北）")}
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className={field}
          />
        </label>
        <button className="min-h-11 self-end rounded bg-teal-900 px-4 py-2 text-white">
          {t("篩選異動")}
        </button>
      </form>
      {canExport && <ExportButton
        href={`/api/export?kind=moves&${query}`}
        fileName="inventory-filtered-moves.xlsx"
      >
        {t("匯出符合條件的異動")}
      </ExportButton>}
    </>
  );
}
