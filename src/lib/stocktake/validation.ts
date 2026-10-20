import {
  MoveError,
  requestId,
  id,
  text,
  quantity,
  decimalText,
} from "@/lib/moves/validation";
export type StocktakeInput = ReturnType<typeof parseStocktake>;
export function parseStocktake(form: FormData) {
  const lines: { itemId: number; actual: string }[] = [];
  const seen = new Set<number>();
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("actual-")) continue;
    const rawId = key.slice(7);
    if (
      !/^[1-9]\d{0,9}$/.test(rawId) ||
      Number(rawId) > 2147483647 ||
      typeof value !== "string"
    )
      throw new MoveError("盤點品項或數量格式錯誤。");
    const itemId = Number(rawId);
    if (seen.has(itemId)) throw new MoveError("盤點品項不可重複。");
    seen.add(itemId);
    if (!value.trim()) continue; // Blank is uncounted, never an implicit zero.
    lines.push({ itemId, actual: decimalText(quantity(value.trim())!) });
  }
  if (!lines.length || lines.length > 50)
    throw new MoveError(
      "每次請填寫 1 至 50 個品項的實際數量，未盤點的欄位請留空。",
    );
  lines.sort((a, b) => a.itemId - b.itemId);
  return {
    requestId: requestId(form),
    locationId: id(form, "locationId"),
    note: text(form, "note", 2000),
    lines,
  };
}
export function stocktakeDelta(actual: string, current: string) {
  // Both operands are fixed-three strings; integer arithmetic has no rounding.
  const delta =
    BigInt(actual.replace(".", "")) - BigInt(current.replace(".", ""));
  const magnitude = delta < BigInt(0) ? -delta : delta;
  if (magnitude > BigInt("999999999999999999"))
    throw new MoveError("盤點差額超出單筆交易精度上限，未寫入任何盤點交易。");
  return {
    signedQty: `${delta < BigInt(0) ? "-" : ""}${decimalText(magnitude)}`,
    normalizedQty: decimalText(magnitude),
    type:
      delta === BigInt(0)
        ? null
        : delta > BigInt(0)
          ? ("ADJUST_GAIN" as const)
          : ("ADJUST_LOSS" as const),
  };
}
