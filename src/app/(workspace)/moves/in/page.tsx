import { randomUUID } from "node:crypto";
import { MoveForm } from "@/components/move-form";
import { moveOptions } from "@/lib/moves/service";
export default async function InPage() {
  const options = await moveOptions();
  return <><h1 className="mb-2 text-2xl font-semibold">入庫</h1><p className="mb-6 text-slate-600">選擇品項與櫃位，預覽後確認新增庫存。</p><MoveForm kind="IN" options={options} requestId={randomUUID()} /></>;
}
