import { decimalText, quantity, requestId, text } from "@/lib/moves/validation";

export function parseManual(form: FormData) {
  return {
    requestId: requestId(form),
    name: text(form, "name", 200, true)!,
    unit: text(form, "unit", 40, true)!,
    area: text(form, "area", 100, true)!,
    cabinetNo: text(form, "cabinetNo", 100, true)!,
    quantity: decimalText(quantity(text(form, "quantity", 19, true))!),
    note: text(form, "note", 2000),
  };
}
export type ManualInput = ReturnType<typeof parseManual>;
