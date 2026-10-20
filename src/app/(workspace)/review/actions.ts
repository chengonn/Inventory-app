"use server";
import { revalidatePath } from "next/cache";
import { previewReview, confirmReview } from "@/lib/review/service";
import { MoveError } from "@/lib/moves/validation";
const message = (error: unknown) =>
  error instanceof MoveError
    ? error.message
    : "處理未完成，請以相同內容重試或重新載入清單。";
export async function previewReviewAction(form: FormData) {
  try {
    return { ok: true as const, preview: await previewReview(form) };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}
export async function confirmReviewAction(form: FormData) {
  try {
    const receipt = await confirmReview(form);
    for (const path of [
      "/review",
      "/inventory",
      "/dashboard",
      "/moves",
      "/stocktake",
    ])
      revalidatePath(path);
    return { ok: true as const, receipt };
  } catch (error) {
    return { ok: false as const, error: message(error) };
  }
}
