# Step 3 真實開發專案連線（2026-09-08）

已建立 inventory-v2-dev（Supabase Seoul），Data API 關閉。此專案用於開發；Dashboard 的 main PRODUCTION 是分支標籤，不代表 Web App 已正式部署。

## 修改檔案與功能

- .env.local（不追蹤）：填入 Dashboard 實際 URL、publishable key、transaction 6543 與 session 5432 URI；暫存密碼欄位已移除。沒有 service-role key。
- prisma/certs/supabase-ca.crt：Dashboard 官方下載的公開 CA，非密鑰。SHA-256 fingerprint：80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA。
- package.json、vitest.live.config.ts、tests/live/supabase.test.ts：加入 opt-in `npm run db:smoke`；預設 npm test 不會連線至雲端。Live suite 明確載入開發 .env.local，只執行唯讀查詢。
- 本報告與專案狀態文件。

## TLS 與驗證結果

最初 pg 回傳 SELF_SIGNED_CERT_IN_CHAIN；設定官方 CA 後，rejectUnauthorized=true 保持啟用，pg 及真實 generated Prisma client/adapter 都成功透過 6543 連線。CA 來源：[Dashboard 指向的官方憑證](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)，用法依 [Supabase SSL 文件](https://supabase.com/docs/guides/platform/ssl-enforcement)。

Runtime 的 DATABASE_SSL_CA 存 PEM。CLI DIRECT_URL 加入本機 CA 的 sslcert 路徑與 sslaccept=strict；移至另一部電腦或 CI 時需使用該環境的憑證路徑，不可直接沿用 Windows 絕對路徑。

| 驗證 | 結果 |
| --- | --- |
| npm test | 98/98 通過 |
| npm run lint | 通過 |
| npm run typecheck | 通過 |
| npm run db:smoke | 4/4 通過；真實 Prisma transaction、migration checksums、RLS/grants 與七個 model 讀取 |
| npm run db:migrate:deploy | 使用者 PowerShell 執行成功，兩份 migration 已套用 |
| npm run db:migrate:status | 使用者 PowerShell 回報 Database schema is up to date!；另由 live test 獨立核對 migration history |

## Migration 與尚存風險

兩份既有 migration 沒有修改，已由使用者 PowerShell 成功套用：

- 202609070001_initial_inventory
- 202609070002_inventory_integrity

隨後本機工具透過真實 Prisma transaction pooler 執行完整 smoke test，確認 migration history 的 finished_at 與 SHA-256 checksum，七張表 RLS、anon/authenticated 無 schema 存取权，以及七個 model 實際讀取。所有查詢唯讀，沒有匯入 Excel 或留下測試交易。

目前工具環境的 Prisma Windows schema engine 曾發生 P1011（-2146893042）；使用者 PowerShell 同一份設定可成功 migration。未停用 TLS 驗證，未手動修改 migration history。未來此工具環境若再次出現同樣錯誤，使用使用者終端執行 Prisma CLI。

## 下一步與限制

Step 3 真實開發資料庫整合完成。下一步為 Step 4 登入、登出與 server-side allowed-email guard，尚未實作。庫存計算、並發出庫 transaction、Excel 匯入與 Vercel production smoke test 均仍在後續步驟。
