"use client";
import { useT } from "@/components/language-provider";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  previewImportAction,
  confirmImportAction,
} from "@/app/(workspace)/import-export/actions";
type Preview = Extract<
  Awaited<ReturnType<typeof previewImportAction>>,
  { ok: true }
>["preview"];
type Receipt = Extract<
  Awaited<ReturnType<typeof confirmImportAction>>,
  { ok: true }
>["receipt"];
const button =
  "min-h-11 rounded-lg bg-teal-900 px-4 py-2 text-white disabled:opacity-50";
export function ImportForm() {
  const t = useT();

  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null),
    [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [page, setPage] = useState(0);
  return (
    <section className="max-w-4xl space-y-4">
      <p className="rounded-lg bg-amber-50 p-4 text-sm">
        {t(
          "僅支援來源範本的「品項設定、InventoryData、StockMoves、移除紀錄」。上傳後先預覽，勾選確認才寫入庫存。上限 3 MB／2000 筆；未知換算或單位列為待確認，不計入庫存。既有主檔不覆寫、既有期初不可再次疊加。",
        )}
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {t(error)}
        </p>
      )}
      {receipt ? (
        <div role="status" className="space-y-2 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">
            {t("匯入完成：批次")}
            {receipt.id}
          </h2>
          <p>
            {t("品項")}
            {receipt.itemCount}
            {t("、期初")}
            {receipt.inventoryCount}
            {t("、異動")} {receipt.moveCount}
            {t("、移除歷史")}
            {receipt.archiveCount}
            {t("、待確認")} {receipt.reviewCount}。
          </p>
          <p className="break-all text-xs">SHA-256：{receipt.fileHash}</p>
          <Link className="block underline" href="/inventory">
            {t("查看庫存")}
          </Link>
          <button
            className="block min-h-11 underline"
            onClick={() => {
              setReceipt(null);
              setPreview(null);
              setConfirmed(false);
            }}
          >
            {t("上傳下一份")}
          </button>
        </div>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setError("");
              setPreview(null);
              setConfirmed(false);
              setPage(0);
              startTransition(async () => {
                try {
                  const result = await previewImportAction(data);
                  if (result.ok) setPreview(result.preview);
                  else setError(result.error);
                } catch {
                  setError("無法取得預覽，請檢查檔案大小與連線後重試。");
                }
              });
            }}
            className="space-y-3 rounded-xl border bg-white p-5"
          >
            <label className="block font-medium">
              {t("Excel 檔案")}
              <input
                className="mt-2 block w-full min-w-0 text-sm"
                type="file"
                name="file"
                accept=".xlsx"
                required
                disabled={pending}
                onChange={() => {
                  setPreview(null);
                  setConfirmed(false);
                  setError("");
                  setPage(0);
                }}
              />
            </label>
            <button className={button} disabled={pending}>
              {pending ? t("處理中…") : t("預覽 Excel")}
            </button>
          </form>
          {preview && (
            <section
              aria-label={t("Excel 匯入預覽")}
              className="space-y-4 rounded-xl border bg-white p-5"
            >
              <h2 className="text-lg font-semibold">{t("匯入預覽")}</h2>
              <p className="break-all">{preview.fileName}</p>
              <p className="break-all text-xs text-slate-500">
                SHA-256：{preview.fileHash}
              </p>
              <p>
                {t("品項")}
                {preview.counts.itemCount}
                {t("、期初")} {preview.counts.inventoryCount}
                {t("、異動")}
                {preview.counts.moveCount}
                {t("、移除歷史")}
                {preview.counts.archiveCount}。
              </p>
              <p>
                {t("已確認")}
                {preview.counts.confirmedCount}
                {t("筆／待確認")} {preview.counts.reviewCount}
                {t("筆；移除歷史不影響庫存。")}
              </p>
              {preview.duplicate && (
                <p role="alert">
                  {t("此檔案已匯入（批次")}
                  {preview.duplicate}）。
                </p>
              )}
              <details open={preview.issues.some((r) => r.level === "error")}>
                <summary className="min-h-11 cursor-pointer">
                  {t("錯誤")}{" "}
                  {preview.issues.filter((r) => r.level === "error").length}
                  {t("／提醒")}{" "}
                  {preview.issues.filter((r) => r.level === "warning").length}
                </summary>
                <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                  {preview.issues.map((r, i) => (
                    <li
                      key={i}
                      className={
                        r.level === "error" ? "text-red-800" : "text-amber-900"
                      }
                    >
                      {r.level === "error" ? t("錯誤") : t("提醒")} · {r.source}
                      ：{r.message}
                    </li>
                  ))}
                </ul>
              </details>
              <details>
                <summary className="min-h-11 cursor-pointer">
                  {t("品項主檔預覽（")}
                  {preview.items.length}
                  {t("筆）")}
                </summary>
                <div className="max-h-80 overflow-y-auto text-sm">
                  {preview.items.map((r) => (
                    <p key={r.name} className="break-words border-b py-2">
                      {r.name}
                      {t("· 單位")}
                      {r.unit ?? t("未填")}
                      {t("· 安全庫存")} {r.safetyStock ?? t("未設定")} ·{" "}
                      {r.note}
                    </p>
                  ))}
                </div>
              </details>
              <div aria-label={t("預覽資料列")} className="space-y-2">
                {preview.rows.slice(page * 20, page * 20 + 20).map((r) => (
                  <article
                    key={r.source}
                    className="break-words rounded-lg bg-slate-50 p-3 text-sm"
                  >
                    <h3 className="font-semibold">
                      {r.itemName} · {r.location}
                    </h3>
                    <p>
                      {r.status === "ARCHIVED"
                        ? t("移除歷史")
                        : r.status === "CONFIRMED"
                          ? t("已確認")
                          : r.status === "IGNORED"
                            ? t("已忽略")
                            : t("待確認")}{" "}
                      · {r.quantity ?? t("未知")} {r.unit}
                    </p>
                    {r.type && (
                      <p>
                        {
                          {
                            IN: t("入庫"),
                            OUT: t("出庫"),
                            ADJUST_GAIN: t("盤盈"),
                            ADJUST_LOSS: t("盤損"),
                          }[r.type]
                        }{" "}
                        {t("· 庫存增減")}
                        {r.signedQty ?? t("不計入")} ·{" "}
                        {r.occurredAt &&
                          new Date(r.occurredAt).toLocaleString("zh-TW", {
                            timeZone: "Asia/Taipei",
                          })}
                      </p>
                    )}
                    <p>
                      {t("原文：")}
                      {r.raw ?? t("未填")}
                    </p>
                    {r.removalReason && (
                      <p>
                        {t("移除原因：")}
                        {r.removalReason}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      {r.source}
                      {t("· 原始位置")}
                      {r.originalSource}
                    </p>
                    <p className="whitespace-pre-wrap text-xs">{r.note}</p>
                  </article>
                ))}
              </div>
              <nav
                aria-label={t("預覽分頁")}
                className="flex items-center gap-3"
              >
                <button
                  className="min-h-11 rounded border px-3"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  {t("上一頁")}
                </button>
                <span>
                  {page + 1} /{" "}
                  {Math.max(1, Math.ceil(preview.rows.length / 20))}
                </span>
                <button
                  className="min-h-11 rounded border px-3"
                  disabled={(page + 1) * 20 >= preview.rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  {t("下一頁")}
                </button>
              </nav>
              <details>
                <summary className="min-h-11 cursor-pointer">
                  {t("匯入後的已確認庫存預估")}
                </summary>
                <div className="max-h-80 overflow-y-auto text-sm">
                  {preview.effects.map((r, i) => (
                    <p key={i}>
                      {r.itemName} · {r.area} / {r.cabinetNo}：{r.after}
                    </p>
                  ))}
                </div>
              </details>
              {preview.token ? (
                <>
                  <p className="text-sm">
                    {t(
                      "預覽有效 30 分鐘。確認時會重新檢查庫存；期間資料若改變，匯入可能被拒絕。",
                    )}
                  </p>
                  <label className="flex min-h-11 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0"
                      checked={confirmed}
                      disabled={pending}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    {t(
                      "我已核對資料、位置與待確認提醒，同意將此整批資料匯入。",
                    )}
                  </label>
                  <button
                    className={button}
                    disabled={pending || !confirmed}
                    onClick={() => {
                      const data = new FormData();
                      data.set("token", preview.token!);
                      data.set("confirmed", "yes");
                      setError("");
                      startTransition(async () => {
                        try {
                          const result = await confirmImportAction(data);
                          if (result.ok) setReceipt(result.receipt);
                          else setError(result.error);
                        } catch {
                          setError(
                            t(
                              "連線中斷，請查閱匯入紀錄或重試；相同檔案不會重複寫入。",
                            ),
                          );
                        }
                      });
                    }}
                  >
                    {pending ? t("匯入中…") : t("確認匯入")}
                  </button>
                </>
              ) : (
                <p className="text-red-800">
                  {t("無法確認匯入。請修正錯誤後重新上傳。")}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
