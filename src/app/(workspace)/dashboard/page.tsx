import Link from "next/link";
import { requirePageActor } from "@/lib/auth/guard";
import { quickActions } from "@/lib/navigation";

export default async function Dashboard() {
  await requirePageActor();
  return <>
    <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-teal-800">INVENTORY / 工作總覽</p>
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">每一筆庫存，都有跡可循。</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">查詢、領用與盤點，從這裡開始。</p>
    <section aria-labelledby="actions-title" className="mt-10">
      <h2 id="actions-title" className="mb-4 text-sm font-semibold">快速操作</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action, index) => <Link key={action.href} href={action.href} className={`group rounded-2xl border p-5 transition-colors ${index === 0 ? "border-teal-900 bg-teal-900 text-white hover:bg-teal-800" : "border-slate-200 bg-white hover:border-teal-600"}`}>
          <div className="mb-7 flex justify-between"><span className="font-mono text-xs opacity-60">0{index + 1}</span><span aria-hidden="true">↗</span></div>
          <h3 className="text-lg font-semibold">{action.label}</h3><p className={`mt-2 text-xs leading-6 ${index === 0 ? "text-teal-100" : "text-slate-500"}`}>{action.description}</p>
        </Link>)}
      </div>
    </section>
    <section aria-labelledby="stock-title" className="mt-9 rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><h2 id="stock-title" className="font-semibold">庫存概況</h2><span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900">尚未啟用</span></div>
      <div className="px-6 py-12 text-center"><div aria-hidden="true" className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-slate-100 text-xl">▤</div><h3 className="font-semibold">等待連接庫存資料</h3><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">登入與主檔管理已可使用。庫存計算與 Excel 預覽匯入將於後續步驟啟用。</p></div>
    </section>
    <p className="mt-5 text-xs leading-6 text-slate-500">目前可維護品項與櫃位；庫存交易、盤點與 Excel 匯入尚未啟用。</p>
  </>;
}
