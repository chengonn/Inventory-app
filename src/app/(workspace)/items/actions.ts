"use server";
import { revalidatePath } from "next/cache";
import { saveMaster } from "@/lib/master-data/service";
import { MasterDataError } from "@/lib/master-data/validation";

export async function saveMasterAction(kind: string, _state: { error: string; saved: boolean }, form: FormData) {
  try { await saveMaster(kind, form); }
  catch (error) { return { error: error instanceof MasterDataError ? error.message : "服務暫時無法使用，請稍後再試。", saved: false }; }
  revalidatePath(kind === "items" ? "/items" : "/locations");
  return { error: "", saved: true };
}
