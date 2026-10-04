import { randomUUID } from "node:crypto";
import Link from "next/link";
import { browseMoves } from "@/lib/moves/browse";
import { MoveFilters } from "@/components/move-filters";
import type { SearchParams } from "@/lib/inventory/read-model";
import { MoveError } from "@/lib/moves/validation";
import { ReversalForm } from "@/components/reversal-form";
const labels = { IN: "入庫", OUT: "出庫", ADJUST_GAIN: "盤盈", ADJUST_LOSS: "盤損", REVERSAL: "沖銷" };
export default async function MovesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  let data: Awaited<ReturnType<typeof browseMoves>>;
  try { data = await browseMoves(await searchParams); } catch (error) { return <p role="alert">{error instanceof MoveError ? error.message : "無法載入異動紀錄。"}</p>; }
  const moves = data.rows;
  return <><h1 className="text-2xl font-semibold">異動紀錄</h1><MoveFilters filters={data.filters} query={data.query} /><p className="my-4 text-slate-600">共 {data.total} 筆，每頁 50 筆；匯出包含所有符合條件的頁面。已確認交易保留原紀錄，以沖銷更正。</p><div className="grid gap-4 xl:grid-cols-2">{moves.map((m) => <article key={m.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">{labels[m.type]} · {m.item}</h2><p>{m.location}</p><p className="my-2">{m.status === "CONFIRMED" ? "已確認" : m.status === "NEEDS_REVIEW" ? "待確認（不計庫存）" : "已忽略"} · {m.signedQty ?? "未知數量"}</p><p className="break-all text-xs text-slate-500">{m.moveNo}</p><time className="text-sm text-slate-500">{new Date(m.at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</time>{m.canReverse && m.signedQty && <ReversalForm originalId={m.id} requestId={randomUUID()} opposite={m.signedQty.startsWith("-") ? m.signedQty.slice(1) : `-${m.signedQty}`} />}</article>)}</div>{!moves.length && <p>尚無交易紀錄。</p>}<nav aria-label="異動分頁" className="my-5 flex gap-4">{data.page > 1 && <Link className="min-h-11 underline" href={`/moves?${data.query}&page=${data.page - 1}`}>上一頁</Link>}<span>{data.page} / {data.pages}</span>{data.page < data.pages && <Link className="min-h-11 underline" href={`/moves?${data.query}&page=${data.page + 1}`}>下一頁</Link>}</nav></>;
}
