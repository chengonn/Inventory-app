"use client";
import { useT } from "@/components/language-provider";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  return (
    <section role="alert" className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">{t("暫時無法載入頁面")}</h1>
      <p>
        {t(
          "請稍後重試。若剛才已送出庫存操作，請先查看異動紀錄，避免另建一筆相同交易。",
        )}
      </p>
      <button
        onClick={reset}
        className="min-h-11 rounded-lg bg-teal-900 px-5 py-3 text-white"
      >
        {t("重新載入")}
      </button>
    </section>
  );
}
