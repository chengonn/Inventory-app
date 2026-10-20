import { getT } from "@/lib/i18n/server";
import { randomUUID } from "node:crypto";
import { MoveForm } from "@/components/move-form";
import { moveOptions } from "@/lib/moves/service";
export default async function InPage() {
  const t = await getT();

  const options = await moveOptions();
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">{t("入庫")}</h1>
      <p className="mb-6 text-slate-600">
        {t("選擇品項與櫃位，預覽後確認新增庫存。")}
      </p>
      <MoveForm kind="IN" options={options} requestId={randomUUID()} />
    </>
  );
}
