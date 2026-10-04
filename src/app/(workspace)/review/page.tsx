import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ReviewForm } from "@/components/review-form";
import { reviewQueue } from "@/lib/review/service";
import type { SearchParams } from "@/lib/inventory/read-model";
export default async function ReviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  let data: Awaited<ReturnType<typeof reviewQueue>>;
  try { data = await reviewQueue(await searchParams); } catch { return <p role="alert">待確認清單暫時無法載入，請稍後重試。</p>; }
  return <div className="space-y-5"><h1 className="text-2xl font-semibold">待確認資料</h1><p>共 {data.total} 筆；這些數量尚未計入已確認庫存。</p><form className="flex gap-2"><input aria-label="搜尋待確認資料" name="q" defaultValue={data.q} maxLength={100} placeholder="品項、位置或原文" className="min-h-11 min-w-0 flex-1 rounded border p-2" /><button className="min-h-11 rounded bg-teal-900 px-4 text-white">搜尋</button></form>{!data.rows.length && <p>沒有待確認資料。</p>}<div className="grid gap-4 xl:grid-cols-2">{data.rows.map((r) => <article key={`${r.entity}-${r.id}`} className="min-w-0 space-y-2 rounded-xl border bg-white p-5"><h2 className="font-semibold">{r.item} · {r.type}</h2><p>{r.location}</p><p className="break-words">原文：{r.raw ?? "未填"}</p><p className="break-words text-sm">來源：{r.source}</p><p className="whitespace-pre-wrap break-words text-sm">{r.note ?? "數量或換算資訊尚未確認，請核對原始紀錄與實物。"}</p><p className="text-sm">原單位 {r.storedUnit ?? "未填"}／主檔單位 {r.unit ?? "未填"}</p><ReviewForm row={r} requestId={randomUUID()} /></article>)}</div><nav aria-label="待確認分頁" className="flex gap-4">{data.page > 1 && <Link href={`/review?q=${encodeURIComponent(data.q)}&page=${data.page - 1}`} className="min-h-11 underline">上一頁</Link>}<span>{data.page} / {data.pages}</span>{data.page < data.pages && <Link href={`/review?q=${encodeURIComponent(data.q)}&page=${data.page + 1}`} className="min-h-11 underline">下一頁</Link>}</nav></div>;
}
