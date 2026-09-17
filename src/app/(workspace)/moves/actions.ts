"use server";
import { revalidatePath } from "next/cache";
import { commitMove, previewMove, reverseMove } from "@/lib/moves/service";
import { MoveError } from "@/lib/moves/validation";
const message = (e: unknown) => e instanceof MoveError ? e.message : "服務暫時無法使用。若確認結果不明，請以相同資料重試，系統會防止重複寫入。";
export async function previewAction(kind: string, form: FormData) {
  try { return { ok: true as const, preview: await previewMove(kind, form) }; }
  catch (e) { return { ok: false as const, error: message(e) }; }
}
function refresh() {
  for (const path of ["/moves", "/moves/in", "/moves/out", "/inventory", "/dashboard"]) revalidatePath(path);
}
export async function commitAction(kind: string, form: FormData) {
  try { const receipt = await commitMove(kind, form); refresh(); return { ok: true as const, receipt }; }
  catch (e) { return { ok: false as const, error: message(e) }; }
}
export async function reversalAction(form: FormData) {
  try { const receipt = await reverseMove(form); refresh(); return { ok: true as const, receipt }; }
  catch (e) { return { ok: false as const, error: message(e) }; }
}
