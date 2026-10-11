"use client";
import { useActionState, useState } from "react";
import { saveMasterAction } from "@/app/(workspace)/items/actions";
import type { MasterKind } from "@/lib/master-data/validation";

export function MasterForm({ kind, initial = {} }: { kind: MasterKind; initial?: Record<string, string> }) {
  const [values, setValues] = useState(initial);
  const [state, action, pending] = useActionState(saveMasterAction.bind(null, kind), { error: "", saved: false });
  const fields = kind === "items" ? [["name", "品項名稱", 200, true], ["unit", "單位", 40, false], ["safetyStock", "安全庫存", 19, false]] as const
    : [["area", "區域", 100, true], ["cabinetNo", "櫃號", 100, true], ["displayName", "顯示名稱", 200, false]] as const;
  const inputClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
  return <form action={action} className="space-y-4">
    <input type="hidden" name="id" value={initial.id ?? ""} /><input type="hidden" name="version" value={initial.version ?? ""} />
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(([name, label, max, required]) => <label key={name} className="block text-sm"><span className="mb-2 block">{label}{required ? " *" : ""}</span><input name={name} readOnly={Boolean(initial.id) && name === "unit"} aria-label={label} required={required} maxLength={max} inputMode={name === "safetyStock" ? "decimal" : undefined} value={values[name] ?? ""} onChange={(e) => setValues({ ...values, [name]: e.target.value })} className={inputClass} /></label>)}
      <label className="block text-sm"><span className="mb-2 block">狀態</span><select name="isActive" aria-label="狀態" value={values.isActive ?? "true"} onChange={(e) => setValues({ ...values, isActive: e.target.value })} className={inputClass}><option value="true">啟用</option><option value="false">停用</option></select></label>
    </div>
    <label className="block text-sm"><span className="mb-2 block">備註</span><textarea name="note" aria-label="備註" maxLength={2000} rows={2} value={values.note ?? ""} onChange={(e) => setValues({ ...values, note: e.target.value })} className={inputClass} /></label>
    {kind === "items" && initial.id && <p className="text-sm text-slate-600">單位建立後不可修改，避免改變歷史庫存的意義；不同單位請另建品項。</p>}
    {state.error && <p role="alert" className="text-sm text-red-800">{state.error}</p>}
    {state.saved && <p role="status" className="text-sm text-teal-800">已儲存。可透過上方搜尋查看資料。</p>}
    <button disabled={pending} className="min-h-11 rounded-lg bg-teal-900 px-5 text-white disabled:opacity-50">{pending ? "儲存中…" : initial.id ? "儲存變更" : "新增"}</button>
  </form>;
}
