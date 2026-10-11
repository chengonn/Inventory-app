"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createInventory } from "./actions";

export function ManualInventoryForm({ requestId }: { requestId: string }) {
  const [id, setId] = useState(requestId);
  return <ManualInventoryFields key={id} requestId={id} onNew={() => setId(crypto.randomUUID())} />;
}

function ManualInventoryFields({ requestId, onNew }: { requestId: string; onNew: () => void }) {
  const [stableRequestId] = useState(requestId);
  const [values, setValues] = useState<Record<string, string>>({ quantity: "0" });
  const field = (name: string) => ({ value: values[name] ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((previous) => ({ ...previous, [name]: event.target.value })) });
  const [state, action, pending] = useActionState(createInventory, { error: "", success: false });
  if (state.success) return <section role="status" className="space-y-4 rounded-xl border border-teal-200 bg-teal-50 p-6"><h2 className="text-xl font-semibold">已建立品項與庫存</h2><p>之後補貨請使用入庫；核對實際數量請使用盤點。</p><div className="flex flex-wrap gap-4"><Link className="min-h-11 rounded-lg bg-teal-900 px-4 py-3 text-white" href="/inventory">查看庫存</Link><button type="button" className="min-h-11 px-4 py-3 underline" onClick={onNew}>再新增一個品項</button></div></section>;
  return <form action={action} className="max-w-2xl space-y-5 rounded-xl border bg-white p-5 sm:p-7">
    <input type="hidden" name="requestId" value={stableRequestId} />
    <fieldset disabled={pending} className="space-y-5">
      <legend className="sr-only">品項與初始庫存</legend>
      <label className="block">品項名稱<input required name="name" {...field("name")} maxLength={200} placeholder="例如：A4 影印紙" className="mt-2 block min-h-11 w-full rounded-lg border p-3" /></label>
      <div className="grid gap-5 sm:grid-cols-2"><label>初始數量<input required name="quantity" {...field("quantity")} inputMode="decimal" pattern="[0-9]{1,15}(\.[0-9]{1,3})?" aria-describedby="quantity-help" className="mt-2 block min-h-11 w-full rounded-lg border p-3" /></label><label>單位<input required name="unit" {...field("unit")} maxLength={40} placeholder="例如：包、個、公斤" className="mt-2 block min-h-11 w-full rounded-lg border p-3" /></label></div>
      <p id="quantity-help" className="text-sm text-slate-600">填入這個位置目前的實際數量，可為 0，最多 3 位小數。新增後不會覆蓋其他品項。</p>
      <div className="grid gap-5 sm:grid-cols-2"><label>區域<input required name="area" {...field("area")} maxLength={100} placeholder="例如：辦公室" className="mt-2 block min-h-11 w-full rounded-lg border p-3" /></label><label>位置<input required name="cabinetNo" {...field("cabinetNo")} maxLength={100} placeholder="例如：A 櫃第 2 層" className="mt-2 block min-h-11 w-full rounded-lg border p-3" /></label></div>
      <label className="block">備註（選填）<textarea name="note" {...field("note")} maxLength={2000} rows={3} className="mt-2 block w-full rounded-lg border p-3" /></label>
      <button className="min-h-11 w-full rounded-lg bg-teal-900 p-3 font-medium text-white disabled:opacity-50" type="submit">{pending ? "儲存中…" : "建立品項與初始庫存"}</button>
    </fieldset>
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
  </form>;
}
