import { getT } from "@/lib/i18n/server";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ManualInventoryForm } from "./form";

export default async function NewInventoryPage() {
  const t = await getT();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t("新增品項與庫存")}</h1>
      <p className="max-w-2xl text-slate-600">
        {t(
          "手動填寫品項、數量、單位與位置，一次完成建檔。已有的品項要補貨，請使用",
        )}
        <Link href="/moves/in" className="underline">
          {t("入庫")}
        </Link>
        。
      </p>
      <ManualInventoryForm requestId={randomUUID()} />
    </div>
  );
}
