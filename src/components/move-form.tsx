"use client";
import Link from "next/link";
import { useState } from "react";
import { previewAction, commitAction } from "@/app/(workspace)/moves/actions";
type Options = { items: { id: number; name: string; unit: string | null }[]; locations: { id: number; area: string; cabinetNo: string }[] };
type Preview = Extract<Awaited<ReturnType<typeof previewAction>>, { ok: true }>["preview"];
const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
export function MoveForm({ kind, options, requestId: initialId }: { kind: "IN" | "OUT"; options: Options; requestId: string }) {
  const [requestId, setRequestId] = useState(initialId);
  const [mode, setMode] = useState("direct");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ data: FormData; value: Preview } | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const label = kind === "IN" ? "入庫" : "出庫";
  async function confirm() {
    if (!preview || pending) return;
    setPending(true); setError("");
    try {
      const result = await commitAction(kind, preview.data);
      if (!result.ok) setError(result.error);
      else setReceipt(`${result.receipt.moveNo}：${result.receipt.status === "NEEDS_REVIEW" ? "待確認，未計入庫存" : "已確認"}${result.receipt.replayed ? "（此請求先前已完成）" : ""}`);
    } catch { setError("連線中斷，請按確認重試；相同請求不會重複寫入。"); }
    finally { setPending(false); }
  }
  if (receipt) return <section className="max-w-xl space-y-5 rounded-xl border border-teal-200 bg-white p-5"><p role="status" className="break-all">{receipt}</p><button className={inputClass} onClick={() => { setRequestId(crypto.randomUUID()); setReceipt(null); setPreview(null); setError(""); }}>建立下一筆{label}</button><Link className="block underline" href="/moves">查看異動紀錄</Link></section>;
  return <div className="max-w-xl space-y-5">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {preview ? <section aria-label="交易預覽" className="space-y-4 rounded-xl border border-teal-200 bg-white p-5">
      <h2 className="text-lg font-semibold">確認{label}</h2>
      <p>{preview.value.item} · {preview.value.location}</p>
      <dl className="grid grid-cols-2 gap-3"><dt>目前已確認庫存</dt><dd>{preview.value.current}</dd><dt>本次{label}</dt><dd>{preview.value.quantity ?? "未知，待確認"} {preview.value.unit}</dd><dt>預計剩餘庫存</dt><dd>{preview.value.after}</dd></dl>
      {preview.value.status === "NEEDS_REVIEW" && <p className="rounded-lg bg-amber-50 p-3">每容器數量未知：本筆將列為待確認，不計入標準庫存，也不能用於出庫。</p>}
      <p className="text-sm text-slate-600">確認時會重新檢查最新庫存。原交易會保留，錯誤交易須以沖銷更正。</p>
      <div className="flex gap-3"><button disabled={pending} onClick={confirm} className="min-h-11 rounded-lg bg-teal-900 px-5 text-white disabled:opacity-50">{pending ? "處理中…" : `確認${label}`}</button><button disabled={pending} onClick={() => { setPreview(null); setError(""); }} className="min-h-11 rounded-lg border px-5">返回修改</button></div>
    </section> : null}
    <form hidden={!!preview} onSubmit={async (event) => {
      event.preventDefault(); if (pending) return;
      const data = new FormData(event.currentTarget); setPending(true); setError("");
      try { const result = await previewAction(kind, data); if (result.ok) setPreview({ data, value: result.preview }); else setError(result.error); }
      catch { setError("無法取得預覽，請稍後重試。"); } finally { setPending(false); }
    }} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <fieldset disabled={pending} className="space-y-4">
        <input type="hidden" name="requestId" value={requestId} />
        <label className="block">品項<select required name="itemId" className={inputClass} defaultValue=""><option value="" disabled>選擇品項</option>{options.items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.unit ? `（${i.unit}）` : ""}</option>)}</select></label>
        <label className="block">櫃位<select required name="locationId" className={inputClass} defaultValue=""><option value="" disabled>選擇櫃位</option>{options.locations.map((l) => <option key={l.id} value={l.id}>{l.area} / {l.cabinetNo}</option>)}</select></label>
        <label className="block">數量輸入方式<select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={inputClass}><option value="direct">直接輸入標準數量</option><option value="container">容器數 × 每容器數量 ＋ 零散數量</option></select></label>
        {mode === "direct" ? <label className="block">標準數量<input required name="quantity" inputMode="decimal" className={inputClass} /></label> : <>
          <label className="block">容器種類<input required name="containerType" maxLength={40} placeholder="例如：箱、盒" className={inputClass} /></label>
          <label className="block">容器數<input required name="containerCount" inputMode="decimal" className={inputClass} /></label>
          <label className="block">每容器數量<input required={kind === "OUT"} name="unitsPerContainer" inputMode="decimal" placeholder={kind === "IN" ? "未知可留空，將列為待確認" : "出庫必填"} className={inputClass} /></label>
          <label className="block">零散數量<input name="looseQty" inputMode="decimal" defaultValue="0" className={inputClass} /></label>
        </>}
        <label className="block">原始數量文字（選填）<input name="rawQuantityText" maxLength={300} className={inputClass} /></label>
        <label className="block">經手人（選填）<input name="operator" maxLength={100} className={inputClass} /></label>
        <label className="block">單據編號（選填）<input name="documentNo" maxLength={100} className={inputClass} /></label>
        <label className="block">備註（選填）<textarea name="note" maxLength={2000} className={inputClass} /></label>
        <button disabled={!options.items.length || !options.locations.length} className="min-h-11 w-full rounded-lg bg-teal-900 px-5 text-white disabled:opacity-50">{pending ? "取得預覽…" : "預覽"}</button>
      </fieldset>
      {(!options.items.length || !options.locations.length) && <p>請先在品項管理與櫃位管理建立啟用中的資料。</p>}
    </form>
  </div>;
}
