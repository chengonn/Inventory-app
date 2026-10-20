import { getT } from "@/lib/i18n/server";
import { randomUUID } from "node:crypto";
import { moveOptions } from "@/lib/moves/service";
import { loadCountSheet } from "@/lib/stocktake/service";
import { StocktakeForm } from "@/components/stocktake-form";
import { MoveError } from "@/lib/moves/validation";
export default async function StocktakePage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}) {
  const t = await getT();

  const { locations } = await moveOptions(),
    params = await searchParams;
  const locationId = locations.find(
    (l) => String(l.id) === params.locationId,
  )?.id;
  let sheet: Awaited<ReturnType<typeof loadCountSheet>> | undefined,
    error = "";
  if (locationId) {
    try {
      sheet = await loadCountSheet(locationId);
    } catch (e) {
      error =
        e instanceof MoveError
          ? e.message
          : t("暫時無法讀取盤點資料，請重新載入。");
    }
  }
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("盤點")}</h1>
      <p className="my-4 text-slate-600">
        {t("依櫃位核對實際數量；確認時重新計算差額並保留歷史。")}
      </p>
      <form
        action="/stocktake"
        className="mb-6 flex max-w-xl flex-wrap items-end gap-3"
      >
        <label className="min-w-0 flex-1">
          {t("櫃位")}
          <select
            name="locationId"
            required
            defaultValue={locationId ?? ""}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
          >
            <option value="" disabled>
              {t("選擇櫃位")}
            </option>
            {locations.map((l) => (
              <option value={l.id} key={l.id}>
                {l.area} / {l.cabinetNo}
              </option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-lg bg-teal-900 px-4 text-white">
          {t("載入盤點表")}
        </button>
      </form>
      {params.locationId && !locationId && (
        <p role="alert">{t("請選擇啟用中的櫃位。")}</p>
      )}
      {error && <p role="alert">{t(error)}</p>}
      {sheet && locationId && (
        <StocktakeForm
          key={locationId}
          locationId={locationId}
          requestId={randomUUID()}
          sheet={sheet}
        />
      )}
    </>
  );
}
