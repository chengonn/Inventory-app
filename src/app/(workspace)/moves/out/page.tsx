import { getT } from "@/lib/i18n/server";
import { randomUUID } from "node:crypto";
import { MoveForm } from "@/components/move-form";
import { moveOptions } from "@/lib/moves/service";
export default async function OutPage() {
  const t = await getT();

  const options = await moveOptions();
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">{t("出庫")}</h1>
      <p className="mb-6 text-slate-600">
        {t("僅可領用已確認庫存，確認時會再次檢查剩餘數量。")}
      </p>
      <MoveForm kind="OUT" options={options} requestId={randomUUID()} />
    </>
  );
}
