"use client";
import { useT } from "@/components/language-provider";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { reviewQueue } from "@/lib/review/service";
import {
  previewReviewAction,
  confirmReviewAction,
} from "@/app/(workspace)/review/actions";
type Row = Awaited<ReturnType<typeof reviewQueue>>["rows"][number];
type Preview = Extract<
  Awaited<ReturnType<typeof previewReviewAction>>,
  { ok: true }
>["preview"];
export function ReviewForm({
  row,
  requestId,
}: {
  row: Row;
  requestId: string;
}) {
  const t = useT();

  const [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
  const [decision, setDecision] = useState("CONFIRM"),
    [mode, setMode] = useState("direct");
  const [preview, setPreview] = useState<{
      data: FormData;
      value: Preview;
    } | null>(null),
    [done, setDone] = useState(false);
  if (done)
    return (
      <p role="status">
        {t("處理完成。")}
        <Link className="underline" href="/review">
          {t("返回清單")}
        </Link>
      </p>
    );
  const field = "block min-h-11 w-full rounded border border-slate-300 p-2";
  return (
    <div className="mt-4 space-y-3">
      {error && (
        <p role="alert" className="text-red-800">
          {t(error)}
        </p>
      )}
      {preview ? (
        <section
          aria-label={t("待確認預覽")}
          className="space-y-3 rounded-lg bg-teal-50 p-4"
        >
          <p>
            {preview.value.decision === "IGNORE"
              ? t("忽略此列，保留歷史且不計庫存")
              : `${t("確認")} ${preview.value.quantity} ${preview.value.unit}`}
          </p>
          <p>
            {t("已確認庫存")}
            {preview.value.current} → {preview.value.after}
          </p>
          <p className="text-sm">
            {t("確認時會鎖定後重新檢查；原文與來源保留在紀錄及 audit。")}
          </p>
          <button
            disabled={pending}
            className="min-h-11 rounded bg-teal-900 px-4 text-white"
            onClick={() => {
              setError("");
              startTransition(async () => {
                try {
                  const r = await confirmReviewAction(preview.data);
                  if (r.ok) setDone(true);
                  else setError(r.error);
                } catch {
                  setError("連線中斷，可用相同內容重試。");
                }
              });
            }}
          >
            {t("確認處理")}
          </button>
          <button
            disabled={pending}
            className="ml-3 min-h-11 rounded border px-4"
            onClick={() => setPreview(null)}
          >
            {t("返回修改")}
          </button>
        </section>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setError("");
            startTransition(async () => {
              try {
                const r = await previewReviewAction(data);
                if (r.ok) setPreview({ data, value: r.preview });
                else setError(r.error);
              } catch {
                setError("無法取得預覽，請稍後重試。");
              }
            });
          }}
        >
          <fieldset disabled={pending} className="space-y-3">
            <input type="hidden" name="entity" value={row.entity} />
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="requestId" value={requestId} />
            <label className="block">
              {t("處理方式")}
              <select
                aria-label={t("處理方式")}
                name="decision"
                className={field}
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option value="CONFIRM">{t("補齊資料並確認")}</option>
                <option value="IGNORE">{t("忽略，不計庫存")}</option>
              </select>
            </label>
            {decision === "CONFIRM" && (
              <>
                <p className="text-sm">
                  {t("標準單位須與品項主檔相同；未確認單位請先到")}
                  <Link href="/items" className="underline">
                    {t("品項管理")}
                  </Link>
                  {t("補齊。不要把不同單位視為相同數量。")}
                </p>
                <label className="block">
                  {t("確認標準單位")}
                  <input
                    name="unit"
                    required
                    maxLength={40}
                    defaultValue={
                      row.unit === t("未註明") ? "" : (row.unit ?? "")
                    }
                    className={field}
                  />
                </label>
                <label className="block">
                  {t("數量方式")}
                  <select
                    aria-label={t("數量方式")}
                    name="mode"
                    className={field}
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="direct">{t("標準數量")}</option>
                    <option value="container">{t("容器換算")}</option>
                  </select>
                </label>
                {mode === "direct" ? (
                  <label className="block">
                    {t("確認數量")}
                    <input
                      name="quantity"
                      inputMode="decimal"
                      required
                      maxLength={19}
                      className={field}
                    />
                  </label>
                ) : (
                  <>
                    {[
                      ["containerType", t("容器類型"), row.containerType ?? ""],
                      ["containerCount", t("容器數"), row.containerCount],
                      [
                        "unitsPerContainer",
                        t("每容器數量"),
                        row.unitsPerContainer,
                      ],
                      ["looseQty", t("零散數量"), row.looseQty],
                    ].map(([name, label, value]) => (
                      <label key={name} className="block">
                        {label}
                        <input
                          name={name}
                          defaultValue={value}
                          required={name !== "looseQty"}
                          maxLength={name === "containerType" ? 40 : 19}
                          inputMode={
                            name === "containerType" ? "text" : "decimal"
                          }
                          className={field}
                        />
                      </label>
                    ))}
                  </>
                )}
              </>
            )}
            <label className="block">
              {t("確認／忽略原因")}
              <textarea
                name="reason"
                maxLength={500}
                required
                className={field}
              />
            </label>
            <button className="min-h-11 rounded bg-teal-900 px-4 text-white">
              {pending ? t("處理中…") : t("預覽處理")}
            </button>
          </fieldset>
        </form>
      )}
    </div>
  );
}
