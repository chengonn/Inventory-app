"use server";
import { revalidatePath } from "next/cache";
import { previewImport, confirmImport } from "@/lib/imports/service";
import { MoveError } from "@/lib/moves/validation";
const message = (error: unknown) =>
  error instanceof MoveError
    ? error.message
    : "服務暫時無法使用。請重新查看匯入紀錄；相同檔案不會重複寫入。";
export async function previewImportAction(form: FormData) {
  try {
    return { ok: true as const, preview: await previewImport(form) };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}
export async function confirmImportAction(form: FormData) {
  try {
    const receipt = await confirmImport(form);
    for (const path of [
      "/import-export",
      "/dashboard",
      "/inventory",
      "/items",
      "/locations",
      "/moves",
      "/stocktake",
      "/review",
    ])
      revalidatePath(path);
    return { ok: true as const, receipt };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}
