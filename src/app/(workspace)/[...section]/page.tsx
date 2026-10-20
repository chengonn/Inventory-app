import { getT } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { navigation } from "@/lib/navigation";
import { requirePageActor } from "@/lib/auth/guard";

export default async function Section({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const t = await getT();

  const { section } = await params;
  const item = navigation.find(
    (entry) => entry.href === `/${section.join("/")}`,
  );
  if (!item) notFound();
  await requirePageActor();
  return (
    <>
      <p className="mb-3 text-xs font-semibold tracking-widest text-teal-800">
        {t("庫存工作空間")}
      </p>
      <h1 className="text-3xl font-semibold">{t(item.label)}</h1>
      <p className="mt-3 text-sm text-slate-500">{t(item.description)}</p>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8">
        <h2 className="font-semibold">{t("功能尚未啟用")}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          {t("此功能將於後續步驟啟用，目前無法讀取或提交庫存交易。")}
        </p>
      </div>
    </>
  );
}
