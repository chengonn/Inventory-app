import nextEnv from "@next/env";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { validatePublicVariables } from "./public-env-policy.mjs";

// Load the same env files as Next before it can inline any public values.
nextEnv.loadEnvConfig(process.cwd(), process.argv.includes("--dev"));
try {
  validatePublicVariables(process.env);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !key) {
    console.info("Supabase 尚未設定：可編譯，但頁面/API 請求將回 503；請參閱 README。");
  } else {
    getSupabaseConfig();
    console.info("Supabase public 環境變數格式檢查通過（尚未驗證雲端連線）。");
  }
} catch {
  console.error("檢查階段資訊（只列名稱，不列值）：", {
    vercel: process.env.VERCEL === "1",
    publicNames: Object.keys(process.env).filter((name) => name.startsWith("NEXT_PUBLIC_")),
  });
  console.error("環境變數檢查失敗：僅允許公開 Supabase URL 與 sb_publishable_ key。請勿將 secret、service-role 或資料庫憑證設為 NEXT_PUBLIC_*；未啟動編譯，亦未輸出變數值。");
  process.exitCode = 1;
}
