import nextEnv from "@next/env";
import { migrationUrl } from "../config/database.ts";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
try {
  if (!migrationUrl(process.env.DIRECT_URL)) throw new Error("missing");
} catch {
  console.error("Migration 尚未執行：請先設定有效的 DIRECT_URL（Supabase direct/session、5432、sslmode=require）。未輸出連線憑證。");
  process.exitCode = 1;
}
