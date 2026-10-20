"use server";
import { revalidatePath } from "next/cache";
import { saveManualInventory } from "@/lib/manual/service";
import { MoveError } from "@/lib/moves/validation";

export async function createInventory(
  _state: { error: string; success: boolean },
  form: FormData,
) {
  try {
    await saveManualInventory(form);
    // 交易成功後才讓相關頁面重新讀取資料，避免畫面繼續顯示舊庫存或選項。
    for (const path of [
      "/dashboard",
      "/inventory",
      "/items",
      "/locations",
      "/moves",
      "/moves/in",
      "/moves/out",
      "/stocktake",
    ])
      revalidatePath(path);
    return { error: "", success: true };
  } catch (error) {
    return {
      error:
        error instanceof MoveError
          ? error.message
          : "暫時無法儲存，請稍後以相同資料重試。",
      success: false,
    };
  }
}
