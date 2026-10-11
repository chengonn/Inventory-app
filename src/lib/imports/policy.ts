import "server-only";
import { MoveError } from "@/lib/moves/validation";

// Legacy migrations remain available only through explicit server configuration.
export function legacyImportEnabled() {
  return process.env.ENABLE_LEGACY_EXCEL_IMPORT === "true";
}
export function requireLegacyImport() {
  if (!legacyImportEnabled()) throw new MoveError("Excel 匯入已停用，請使用新增品項與庫存。");
}
