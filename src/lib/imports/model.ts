import { z } from "zod";

export const IMPORT_VERSION = 1;
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_ROWS = 2000;
const decimal = z.string().regex(/^\d{1,15}\.\d{3}$/);
const nullableText = z.string().max(2000).nullable();
const quantity = z.object({
  rawQuantityText: nullableText, containerType: nullableText,
  containerCount: decimal.nullable(), unitsPerContainer: decimal.nullable(), looseQty: decimal.nullable(),
  unit: nullableText, normalizedQty: decimal.nullable(), status: z.enum(["CONFIRMED", "NEEDS_REVIEW", "IGNORED"]),
  note: nullableText,
});
const source = { sourceSheet: z.string().max(40), sourceCell: z.string().max(300), row: z.number().int().positive() };
const ledger = quantity.extend({ ...source, itemName: z.string().min(1).max(200), area: z.string().min(1).max(100), cabinetNo: z.string().min(1).max(100) });
export const planSchema = z.object({
  version: z.literal(IMPORT_VERSION), fileName: z.string().min(1).max(200), fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  items: z.array(z.object({ name: z.string().min(1).max(200), unit: z.string().max(40).nullable(), safetyStock: decimal.nullable(), note: nullableText })).max(MAX_ROWS),
  openings: z.array(ledger).max(MAX_ROWS),
  moves: z.array(ledger.extend({ moveNo: z.string().max(100), occurredAt: z.string().datetime(), type: z.enum(["IN", "OUT", "ADJUST_GAIN", "ADJUST_LOSS"]), signedQty: z.string().regex(/^-?\d{1,15}\.\d{3}$/).nullable(), operator: nullableText, documentNo: nullableText })).max(MAX_ROWS),
  archives: z.array(quantity.extend({ ...source, itemName: z.string().min(1).max(200), area: nullableText, cabinetNo: nullableText, removedAt: z.string().datetime().nullable(), originalStatus: nullableText, removalReason: nullableText })).max(MAX_ROWS),
  issues: z.array(z.object({ level: z.enum(["error", "warning"]), source: z.string(), message: z.string() })).max(MAX_ROWS * 5),
});
export type ImportPlan = z.infer<typeof planSchema>;
export type ImportLine = ImportPlan["openings"][number];
export function counts(plan: ImportPlan) {
  const rows = [...plan.openings, ...plan.moves];
  return { itemCount: plan.items.length, inventoryCount: plan.openings.length, moveCount: plan.moves.length, archiveCount: plan.archives.length,
    reviewCount: rows.filter((r) => r.status === "NEEDS_REVIEW").length, confirmedCount: rows.filter((r) => r.status === "CONFIRMED").length };
}
