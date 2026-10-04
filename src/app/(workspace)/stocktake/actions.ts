"use server";
import { revalidatePath } from "next/cache";
import { previewStocktake, confirmStocktake } from "@/lib/stocktake/service";
import { MoveError } from "@/lib/moves/validation";
const message = (error: unknown) => error instanceof MoveError ? error.message : "服務暫時無法使用。若確認結果不明，請以相同內容重試，勿重新建立盤點。";
export async function previewCountAction(form: FormData) {
  try { return { ok: true as const, rows: await previewStocktake(form) }; }
  catch (error) { return { ok: false as const, error: message(error) }; }
}
export async function confirmCountAction(form: FormData) {
  try {
    const receipt = await confirmStocktake(form);
    for (const path of ["/stocktake", "/moves", "/moves/in", "/moves/out", "/inventory", "/dashboard"]) revalidatePath(path);
    return { ok: true as const, receipt };
  } catch (error) { return { ok: false as const, error: message(error) }; }
}
