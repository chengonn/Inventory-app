"use client";
import { useT } from "@/components/language-provider";

import Link from "next/link";
import { useState } from "react";
import {
  previewCountAction,
  confirmCountAction,
} from "@/app/(workspace)/stocktake/actions";
type Preview = Extract<
  Awaited<ReturnType<typeof previewCountAction>>,
  { ok: true }
>["rows"];
type Receipt = Extract<
  Awaited<ReturnType<typeof confirmCountAction>>,
  { ok: true }
>["receipt"];
type Sheet = {
  location: string;
  items: { id: number; name: string; unit: string | null; current: string }[];
};
export function StocktakeForm({
  sheet,
  locationId,
  requestId,
}: {
  sheet: Sheet;
  locationId: number;
  requestId: string;
}) {
  const t = useT();

  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    data: FormData;
    rows: Preview;
  } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  if (receipt)
    return (
      <section className="max-w-2xl space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold" role="status">
          {t("盤點已完成")}
          {receipt.replayed ? t("（原請求已完成，未重複寫入）") : ""}
        </h2>
        <p className="break-all text-sm">ST-{receipt.requestId}</p>
        {receipt.rows.map((r) => (
          <p key={r.itemId}>
            {sheet.items.find((i) => i.id === r.itemId)?.name ?? r.itemId}
            {t("：確認時")}
            {r.current}
            {t("→ 實際")}
            {r.actual}；
            {r.type === "ADJUST_GAIN"
              ? t("盤盈")
              : r.type === "ADJUST_LOSS"
                ? t("盤損")
                : t("無差額，不建立交易")}{" "}
            {r.type ? r.signedQty : ""}
          </p>
        ))}
        <Link className="block underline" href="/moves">
          {t("查看異動紀錄")}
        </Link>
        <a
          className="block underline"
          href={`/stocktake?locationId=${locationId}`}
        >
          {t("重新載入，建立下一次盤點")}
        </a>
      </section>
    );
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">{sheet.location}</h2>
      <p className="rounded-lg bg-amber-50 p-4 text-sm">
        {t(
          "目前數量只含已確認庫存。待確認資料不計入，請先核對實物來源，避免重複計數。盤點期間請停止搬動本櫃位物品；確認前若有搬動，請重新清點。每次最多 50 個品項。",
        )}
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {t(error)}
        </p>
      )}
      {preview && (
        <section
          aria-label={t("盤點預覽")}
          className="space-y-4 rounded-xl border bg-white p-5"
        >
          <h3 className="font-semibold">{t("確認盤點差額")}</h3>
          {preview.rows.map((r) => (
            <p key={r.itemId}>
              {r.name}
              {t("：目前")}
              {r.current}
              {t("→ 實際")}
              {r.actual} {r.unit}；
              {r.type === "ADJUST_GAIN"
                ? t("盤盈")
                : r.type === "ADJUST_LOSS"
                  ? t("盤損")
                  : t("無差額")}{" "}
              {r.type ? r.signedQty : ""}
            </p>
          ))}
          <p className="text-sm text-slate-600">
            {t(
              "確認時會鎖定後重新計算差額，最終結果可能與預覽不同。只更新本次填寫的品項。",
            )}
          </p>
          <div className="flex gap-3">
            <button
              disabled={pending}
              className="min-h-11 rounded-lg bg-teal-900 px-4 text-white disabled:opacity-50"
              onClick={async () => {
                if (pending) return;
                setPending(true);
                setError("");
                try {
                  const result = await confirmCountAction(preview.data);
                  if (result.ok) setReceipt(result.receipt);
                  else setError(result.error);
                } catch {
                  setError(
                    t("連線中斷，請以相同內容按確認重試，避免建立重複盤點。"),
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? t("處理中…") : t("確認盤點")}
            </button>
            <button
              disabled={pending}
              className="min-h-11 rounded-lg border px-4"
              onClick={() => {
                setPreview(null);
                setError("");
              }}
            >
              {t("返回修改")}
            </button>
          </div>
        </section>
      )}
      <form
        hidden={!!preview}
        className="rounded-xl border bg-white p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending) return;
          const data = new FormData(e.currentTarget);
          setPending(true);
          setError("");
          try {
            const result = await previewCountAction(data);
            if (result.ok) setPreview({ data, rows: result.rows });
            else setError(result.error);
          } catch {
            setError("無法取得預覽，請稍後重試。");
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="space-y-4">
          <input type="hidden" name="locationId" value={locationId} />
          <input type="hidden" name="requestId" value={requestId} />
          <p className="text-sm">{t("留空＝未盤點；輸入 0＝實際為零。")}</p>
          {sheet.items.map((i) => (
            <label key={i.id} className="block border-b border-slate-100 pb-4">
              <span className="block font-medium">
                {i.name}
                {t("實際數量")}
              </span>
              <span className="block text-sm text-slate-500">
                {t("已確認庫存")}
                {i.current} {i.unit}
              </span>
              <input
                aria-label={`${i.name} ${t("實際數量")}`}
                name={`actual-${i.id}`}
                inputMode="decimal"
                maxLength={19}
                placeholder={t("未盤點，留空")}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3"
              />
            </label>
          ))}
          <label className="block">
            {t("盤點備註（選填）")}
            <textarea
              name="note"
              maxLength={2000}
              className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-3"
            />
          </label>
          <button
            disabled={!sheet.items.length}
            className="min-h-11 w-full rounded-lg bg-teal-900 px-4 text-white disabled:opacity-50"
          >
            {pending ? t("取得預覽…") : t("預覽盤點")}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
