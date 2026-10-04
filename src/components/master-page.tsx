import Link from "next/link";
import { requirePageActor } from "@/lib/auth/guard";
import { listMasters } from "@/lib/master-data/service";
import type { MasterKind } from "@/lib/master-data/validation";
import { MasterForm } from "./master-form";

export type MasterSearch = Promise<{ q?: string; status?: string; page?: string }>;
export async function MasterPage({ kind, searchParams }: { kind: MasterKind; searchParams: MasterSearch }) {
  await requirePageActor();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const status = ["all", "inactive"].includes(params.status ?? "") ? params.status! : "active";
  const parsed = Number(params.page);
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
  let data;
  try { data = await listMasters(kind, q, status, page); }
  catch { return <section><h1 className="text-3xl font-semibold">{kind === "items" ? "品項管理" : "櫃位管理"}</h1><p role="alert" className="mt-6">暫時無法載入主檔，請稍後重新整理或重新登入。</p></section>; }
  const title = kind === "items" ? "品項管理" : "櫃位管理";
  const href = (p: number) => `/${kind}?${new URLSearchParams({ q, status, page: String(p) })}`;
  return <>
    <h1 className="text-3xl font-semibold">{title}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">停用會保留歷史。{kind === "items" ? "品項名稱永久唯一；重複使用請重新啟用原品項。" : "同一區域的櫃號不可重複。"}</p>
    <details className="my-7 rounded-xl border border-slate-200 bg-white p-5"><summary className="min-h-11 cursor-pointer font-medium">新增{kind === "items" ? "品項" : "櫃位"}</summary><MasterForm kind={kind} /></details>
    <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
      <label className="min-w-0 flex-1 text-sm">搜尋<input name="q" aria-label="搜尋" defaultValue={q} maxLength={200} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3" /></label>
      <label className="text-sm">顯示狀態<select name="status" aria-label="顯示狀態" defaultValue={status} className="mt-2 block min-h-11 rounded-lg border border-slate-300 bg-white px-3"><option value="active">啟用</option><option value="inactive">停用</option><option value="all">全部</option></select></label>
      <button className="min-h-11 rounded-lg border border-teal-900 px-5 text-teal-900">查詢</button>
    </form>
    <div className="space-y-3">
      {data.rows.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">沒有符合條件的資料。</p>}
      {data.rows.map((row) => <details key={`${row.id}:${row.version}`} className="rounded-xl border border-slate-200 bg-white p-5">
        <summary className="min-h-11 cursor-pointer break-words"><strong>{"name" in row ? row.name : `${row.area} / ${row.cabinetNo}`}</strong><span className="ml-3 text-xs text-slate-500">{row.isActive === "true" ? "啟用" : "停用"} · 編輯</span></summary>
        <MasterForm kind={kind} initial={Object.fromEntries(Object.entries(row).filter((entry): entry is [string, string] => typeof entry[1] === "string"))} />
      </details>)}
    </div>
    <nav aria-label="分頁" className="mt-6 flex items-center gap-5">{page > 1 && <Link href={href(page - 1)} className="min-h-11 py-3">上一頁</Link>}<span className="text-sm">第 {page} 頁</span>{data.hasNext && <Link href={href(page + 1)} className="min-h-11 py-3">下一頁</Link>}</nav>
  </>;
}
