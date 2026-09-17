export type MasterKind = "items" | "locations";
export class MasterDataError extends Error {}
export function masterKind(value: string): MasterKind {
  if (value !== "items" && value !== "locations") throw new MasterDataError("不支援的主檔類型。");
  return value;
}
function field(form: FormData, name: string, max: number, required = false) {
  const raw = form.get(name);
  if (raw !== null && typeof raw !== "string") throw new MasterDataError("欄位格式錯誤。");
  const value = (raw ?? "").trim();
  if ((required && !value) || value.length > max) throw new MasterDataError(`${name} 為必填或超過長度限制（${max}）。`);
  return value || null;
}
export function parseMaster(kind: MasterKind, form: FormData) {
  const active = form.get("isActive");
  if (active !== "true" && active !== "false") throw new MasterDataError("請指定啟用狀態。");
  const common = { note: field(form, "note", 2000), isActive: active === "true" };
  if (kind === "locations") return { ...common, area: field(form, "area", 100, true)!, cabinetNo: field(form, "cabinetNo", 100, true)!, displayName: field(form, "displayName", 200) };
  const safetyStock = field(form, "safetyStock", 19);
  if (safetyStock && !/^\d{1,15}(\.\d{1,3})?$/.test(safetyStock)) throw new MasterDataError("安全庫存須為非負數，最多 15 位整數與 3 位小數。");
  return { ...common, name: field(form, "name", 200, true)!, unit: field(form, "unit", 40), safetyStock };
}
export function parseIdentity(form: FormData) {
  const raw = form.get("id");
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new MasterDataError("主檔編號無效。");
  const version = form.get("version");
  if (typeof version !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(version) || !Number.isFinite(Date.parse(version))) throw new MasterDataError("版本無效，請重新整理。");
  return { id: Number(raw), updatedAt: new Date(version) };
}
