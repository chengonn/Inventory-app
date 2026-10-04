import { MoveError, text, id, requestId, quantity, decimalText } from "@/lib/moves/validation";
import { z } from "zod";
const decimal = z.string().regex(/^\d{1,15}\.\d{3}$/).nullable();
const schema = z.object({ entity: z.enum(["OpeningInventory", "StockMove"]), id: z.number().int().positive().max(2147483647), requestId: z.uuid(), decision: z.enum(["CONFIRM", "IGNORE"]), reason: z.string().min(1).max(500), unit: z.string().min(1).max(40).nullable(), normalizedQty: decimal, containerType: z.string().max(40).nullable(), containerCount: decimal, unitsPerContainer: decimal, looseQty: decimal });
export type ReviewInput = ReturnType<typeof parseReview>;
export function parseReview(form: FormData) {
  const parsed = schema.safeParse(reviewFields(form));
  if (!parsed.success) throw new MoveError("待確認欄位格式不正確，請重新填寫。");
  return parsed.data;
}
function reviewFields(form: FormData) {
  const entity = text(form, "entity", 20, true);
  if (entity !== "OpeningInventory" && entity !== "StockMove") throw new MoveError("待確認資料類型無效。");
  const decision = text(form, "decision", 10, true);
  if (decision !== "CONFIRM" && decision !== "IGNORE") throw new MoveError("處理方式無效。");
  const base = { entity, id: id(form, "id"), requestId: requestId(form), decision, reason: text(form, "reason", 500, true)! };
  if (decision === "IGNORE") return { ...base, unit: null, normalizedQty: null, containerType: null, containerCount: null, unitsPerContainer: null, looseQty: null };
  const unit = text(form, "unit", 40, true)!;
  if (unit === "未註明") throw new MoveError("請先確認品項主檔的標準單位。");
  const mode = text(form, "mode", 10, true);
  let amount: bigint, containerType: string | null = null, containerCount: string | null = null, unitsPerContainer: string | null = null, looseQty: string | null = null;
  if (mode === "direct") { amount = quantity(text(form, "quantity", 19, true))!; looseQty = decimalText(amount); }
  else if (mode === "container") {
    containerType = text(form, "containerType", 40, true);
    const count = quantity(text(form, "containerCount", 19, true))!, units = quantity(text(form, "unitsPerContainer", 19, true))!, loose = quantity(text(form, "looseQty", 19), false) ?? BigInt(0);
    if (count <= BigInt(0) || units <= BigInt(0)) throw new MoveError("容器數與每容器數量須大於零。");
    const product = count * units;
    if (product % BigInt(1000)) throw new MoveError("換算結果超過 3 位小數，不會自動四捨五入。");
    amount = product / BigInt(1000) + loose;
    containerCount = decimalText(count); unitsPerContainer = decimalText(units); looseQty = decimalText(loose);
  } else throw new MoveError("數量輸入方式無效。");
  const normalizedQty = decimalText(amount); quantity(normalizedQty);
  if (entity === "StockMove" && amount === BigInt(0)) throw new MoveError("異動數量必須大於零。");
  return { ...base, unit, normalizedQty, containerType, containerCount, unitsPerContainer, looseQty };
}
