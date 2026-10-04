# Vercel 部署與 release

Step 12 準備中，尚未宣稱 Production 部署或 smoke test 成功。

## 專案

- Framework：Next.js；Node.js：24.x；install：`npm ci`；build：`npm run build`。
- CLI 從 `outputs/inventory-app` 執行，這個目錄本身是 Git repository root。若從 GitHub `chengonn/Inventory-app` 匯入，Root Directory 為 `.`。
- 現有完整程式在 `master`；`main` 仍是 initial commit。不要把 main 當作最新版本自動部署。Step 10–12 未 commit 的程式必須先確認所部署來源完整；CLI 可部署工作目錄，不要求先 push。
- `.vercelignore` 排除 .env、Excel、測試結果及本機 build。秘密透過 Vercel environment variables 設定，不能上傳 .env 當作原始碼。
- Function timeout 60 秒；區域應靠近正式 Supabase 專案，待確定正式資料庫區域後設定。

## 環境

| 變數 | 用途 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | 正式 Supabase HTTPS project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | 同一專案 publishable key，可供 browser 使用 |
| ALLOWED_USER_EMAIL | 唯一使用者；server-only |
| DATABASE_URL | 正式 Supavisor transaction pooler，6543；server-only |
| DIRECT_URL | 同一專案 direct/session pooler，5432，`sslmode=require&schema=inventory`；migration 用途 |
| DATABASE_SSL_CA | 需要時使用 Supabase CA PEM；不可停用 TLS 驗證 |
| DB_POOL_MAX | 每個 warm instance 的 pool 上限，預設 2 |
| INVENTORY_READ_ONLY | `true` 為緊急唯讀；正常 Production 為 `false` |

不需要 service-role key。從 Supabase Connect 複製實際連線，不推測 hostname/user/password。不得把 DATABASE_URL 或 DIRECT_URL 加 NEXT_PUBLIC_。

Preview 預設不配置 Production secrets；使用獨立 dev 專案，或在使用者明確決定後共用。程式於 VERCEL_ENV=preview 一律禁止業務寫入，即使誤帶 Production DB 也不開放 mutation。登入／登出仍可使用，匯出仍需 allowed-email 授權。

## Migration release gate

1. 明確選定正式 Supabase 專案；確認 URL、publishable key、DATABASE_URL、DIRECT_URL 屬同一專案，停用公開 signup，建立唯一 allowed email 使用者。
2. 設定 Vercel Production env，透過 `vercel env pull .env.production.local --environment=production` 取得本機被 Git 忽略的 release env；不要覆蓋 dev `.env.local`。
3. 在新的 PowerShell 工作階段設 `$env:NODE_ENV='production'`，確認 `.env.production.local` 含全部正式變數，沒有其他 shell 變數覆寫，然後依序執行 `npm run db:migrate:deploy` 與 `npm run db:migrate:status`。此命令由 Prisma 7.10 config 讀取 DIRECT_URL。
4. migration status 及兩份 checksum 成功後才 `vercel deploy --prod`。build/request 不執行 migration；Preview 禁止 migration。不要用 migrate dev、db push、reset 處理 Production。
5. 本次沒有新增 migration。既有正式 schema 若是新的資料庫，需要套用兩份 migration；若沿用已套用專案，也必須核對 status，不能把 dev 測試當作另一個 DB 已完成。

## Auth、HTTPS 與驗收

- Supabase Auth Site URL 設為正式 HTTPS origin；redirect allowlist 僅列需要的 origin，不使用廣泛 wildcard。Email/password login 使用同一正式專案既有帳號；Dashboard 密碼不是 App 密碼。
- 不建立 signup。遺失 App 密碼時由管理者透過 Supabase Auth 管理流程重設；不將密碼放入 Git、環境變數範例或對話。
- `npm run test:production:anonymous -- https://實際正式網域` 執行 16 項未登入 HTTPS 檢查：登入頁、11 個受保護頁及 4 API。只讀、不建立業務資料；它不等於已完成登入與 DB smoke。
- 真實登入後驗證 refresh/session、搜尋、匯出、登出；以明確標記的驗收品項驗證入庫／出庫／盤點／reversal／audit。正式交易不 hard delete，測試品項最後停用，必要時用 reversal 回復。
- Preview 驗證寫入被拒絕。Production 驗證非 allowed email 被拒絕。不要把隔離 Auth fixture 部署上線。
- 手機切行動網路開正式 HTTPS；關閉 Windows 後再測。此項必須使用者實機完成，瀏覽器 viewport 不替代實機驗收。

## 備份與回復

部署前後保留完整業務 Excel 備份（Step 11），另依實際 Supabase 方案確認 database backup/PITR。Vercel rollback 只回復程式，不回復資料庫；優先使用相容 migration，不擅自 reset DB。還原須先在隔離專案驗證，無自動 Excel restore endpoint。

## 官方文件

- [Vercel CLI deployment](https://vercel.com/docs/cli/deploy)
- [Vercel environment CLI](https://vercel.com/docs/cli/env)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Prisma migrate deploy](https://docs.prisma.io/docs/cli/migrate/deploy)

本機命令若 npm shim 失效，使用 `& 'C:\Program Files\nodejs\npm.cmd'`。
