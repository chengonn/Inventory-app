export class MoveError extends Error {}
export type MoveInput = ReturnType<typeof parseMove>;
const MAX = BigInt("999999999999999999"); // numeric(18,3) represented in thousandths.
export function text(
  form: FormData,
  name: string,
  max: number,
  required = false,
) {
  const raw = form.get(name);
  if (raw !== null && typeof raw !== "string")
    throw new MoveError("欄位格式錯誤。");
  const value = (raw ?? "").trim();
  if ((required && !value) || value.length > max)
    throw new MoveError(`${name} 未填或超過長度限制。`);
  return value || null;
}
export function id(form: FormData, name: string) {
  const value = text(form, name, 10, true)!;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647)
    throw new MoveError("品項、櫃位或交易編號無效。");
  return Number(value);
}
export function decimalText(value: bigint) {
  return `${value / BigInt("1000")}.${String(value % BigInt("1000")).padStart(3, "0")}`;
}
export function quantity(value: string | null, required = true): bigint | null {
  if (!value && !required) return null;
  if (!value || !/^\d{1,15}(\.\d{1,3})?$/.test(value))
    throw new MoveError("數量須為非負十進位數，最多 15 位整數與 3 位小數。");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt("1000") + BigInt(fraction.padEnd(3, "0"));
}
export function requestId(form: FormData) {
  const value = text(form, "requestId", 36, true)!;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new MoveError("請求編號無效，請重新整理。");
  return value.toLowerCase();
}
export function parseMove(kind: string, form: FormData) {
  if (kind !== "IN" && kind !== "OUT") throw new MoveError("交易類型無效。");
  const mode = text(form, "mode", 10, true);
  let normalizedQty: string | null;
  let containerCount: string | null = null,
    unitsPerContainer: string | null = null,
    looseQty: string | null = null,
    containerType: string | null = null;
  if (mode === "direct") {
    const amount = quantity(text(form, "quantity", 19))!;
    if (amount === BigInt("0")) throw new MoveError("交易數量必須大於零。");
    normalizedQty = decimalText(amount);
  } else if (mode === "container") {
    const count = quantity(text(form, "containerCount", 19))!;
    const units = quantity(text(form, "unitsPerContainer", 19), false);
    const loose = quantity(text(form, "looseQty", 19), false) ?? BigInt("0");
    if (count === BigInt("0")) throw new MoveError("容器數必須大於零。");
    containerType = text(form, "containerType", 40, true);
    containerCount = decimalText(count);
    unitsPerContainer = units === null ? null : decimalText(units);
    looseQty = decimalText(loose);
    if (units === null) {
      if (kind === "OUT")
        throw new MoveError("出庫必須知道標準數量，未知容器數量不能支撐出庫。");
      normalizedQty = null;
    } else {
      const product = count * units;
      if (product % BigInt("1000") !== BigInt("0"))
        throw new MoveError(
          "換算結果超過 3 位小數，請修正輸入，系統不會自動四捨五入。",
        );
      const amount = product / BigInt("1000") + loose;
      if (amount <= BigInt("0") || amount > MAX)
        throw new MoveError("換算數量須大於零且不可超過資料庫精度上限。");
      normalizedQty = decimalText(amount);
    }
  } else throw new MoveError("數量輸入方式無效。");
  return {
    requestId: requestId(form),
    type: kind as "IN" | "OUT",
    itemId: id(form, "itemId"),
    locationId: id(form, "locationId"),
    normalizedQty,
    status:
      normalizedQty === null
        ? ("NEEDS_REVIEW" as const)
        : ("CONFIRMED" as const),
    signedQty:
      normalizedQty === null
        ? null
        : kind === "OUT"
          ? `-${normalizedQty}`
          : normalizedQty,
    containerType,
    containerCount,
    unitsPerContainer,
    looseQty,
    rawQuantityText: text(form, "rawQuantityText", 300),
    operator: text(form, "operator", 100),
    documentNo: text(form, "documentNo", 100),
    note: text(form, "note", 2000),
  };
}
export function parseReversal(form: FormData) {
  return {
    requestId: requestId(form),
    originalId: id(form, "originalId"),
    note: text(form, "note", 2000, true)!,
  };
}
