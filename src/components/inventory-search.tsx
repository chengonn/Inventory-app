import { getT } from "@/lib/i18n/server";
export async function InventorySearch({
  q = "",
  low = false,
}: {
  q?: string;
  low?: boolean;
}) {
  const t = await getT();

  return (
    <form
      action="/inventory"
      className="my-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <label className="min-w-0 flex-[1_1_240px]">
        {t("搜尋品項、區域或櫃號")}
        <input
          name="q"
          defaultValue={q}
          maxLength={100}
          placeholder={t("例如：膠帶、A 區、櫃號")}
          className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="low" value="1" defaultChecked={low} />
        {t("僅看低庫存")}
      </label>
      <button className="min-h-11 rounded-lg bg-teal-900 px-5 text-white">
        {t("搜尋")}
      </button>
    </form>
  );
}
