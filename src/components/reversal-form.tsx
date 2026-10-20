"use client";
import { useT } from "@/components/language-provider";

import { useState } from "react";
import { reversalAction } from "@/app/(workspace)/moves/actions";
export function ReversalForm({
  originalId,
  requestId,
  opposite,
}: {
  originalId: number;
  requestId: string;
  opposite: string;
}) {
  const t = useT();

  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  if (saved) return <p role="status">{t("沖銷已完成。")}</p>;
  return (
    <details className="mt-4">
      <summary className="min-h-11 cursor-pointer py-2 text-teal-900">
        {t("沖銷此交易")}
      </summary>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending) return;
          const data = new FormData(e.currentTarget);
          setPending(true);
          setError("");
          try {
            const result = await reversalAction(data);
            if (result.ok) setSaved(true);
            else setError(result.error);
          } catch {
            setError("連線中斷，請以相同資料重試。");
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="space-y-3">
          <input type="hidden" name="originalId" value={originalId} />
          <input type="hidden" name="requestId" value={requestId} />
          <p>
            {t("將新增數量")}
            {opposite}{" "}
            {t("的反向交易，並保留原紀錄。若造成負庫存，系統將拒絕。")}
          </p>
          <label className="block">
            {t("沖銷原因")}
            <textarea
              required
              name="note"
              maxLength={2000}
              className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-3"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input required type="checkbox" />
            {t("我已核對並確認沖銷")}
          </label>
          <button className="min-h-11 rounded-lg bg-teal-900 px-5 text-white">
            {pending ? t("處理中…") : t("確認沖銷")}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="text-red-800">
            {t(error)}
          </p>
        )}
      </form>
    </details>
  );
}
