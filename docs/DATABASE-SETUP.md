# PostgreSQL / Prisma 設定（Step 3）

> 2026-09-08 更新：Supabase 開發專案已建立，兩份 migration 已套用，runtime pooled connection 與完整 4 項雲端 smoke test 已通過。最新狀態見 [真實連線報告](STEP-03-LIVE.md)。以下未設定專案的敘述為先前離線階段紀錄。

兩份 migration 已套用 Supabase 開發資料庫；真實 Prisma pooled connection、migration checksum、七表 RLS 與讀取驗證皆通過。規格仍以 [V2.md](V2.md) 為唯一來源。

## 版本與官方依據

鎖定 Prisma CLI、client、adapter-pg 7.10.0 與 pg 8.23.0，使用穩定版而非 registry 的 8.0 RC。Prisma 7 的 URL 放在 prisma.config.ts；runtime 使用 pg adapter，pool 參數由 pg 設定。[Prisma config](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)、[connection pool](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool)。

Supabase 官方建議 serverless 使用 transaction pooler、migration 使用 direct 或 session connection。[Supabase Prisma](https://supabase.com/docs/guides/database/prisma)、[連線方式](https://supabase.com/docs/guides/database/connecting-to-postgres)。

## 建立專案後設定

從 Supabase Dashboard 的 Connect 複製該專案實際 PostgreSQL URI，放入未追蹤的 .env.local。不要自行猜 project reference、region、host、帳號或密碼；URI 密碼需正確 URL encoding。

| 變數 | 用途與驗證 |
| --- | --- |
| DATABASE_URL | shared Supavisor transaction pooler，host 結尾 .pooler.supabase.com，port 6543；僅 server runtime 讀取 |
| DIRECT_URL | direct db host 或 shared session pooler，port 5432；設定 sslmode=require 與 schema=inventory；僅 Prisma CLI 使用 |
| DB_POOL_MAX | 每個 runtime instance 的 pg pool 上限，預設 2，允許 1–10 |
| DATABASE_SSL_CA | 若憑證鏈需要 Supabase CA，填入官方取得的 PEM；支援實際換行或字面 \\n |

Direct connection 通常需要 IPv6；Windows 網路若僅 IPv4，使用 Dashboard 提供的 session pooler。DIRECT_URL 不會 fallback 至 DATABASE_URL，缺少設定時 migration scripts 會先中止。所有 database 變數禁止 NEXT_PUBLIC_ 前綴。

Runtime 明確設定 TLS rejectUnauthorized=true、連線逾時 5 秒、idle 10 秒；不接受舊版 Prisma Rust engine 的 connection_limit/pool_timeout。URL 的 schema、sslmode、pgbouncer=true 在驗證後移除，避免 pg URL SSL 選項覆蓋明確 CA 設定。pgbouncer 參數不控制 pg adapter；實際 adapter-pg 7.10.0 未提供 statementNameGenerator 時使用 unnamed statements。[pg queries](https://node-postgres.com/features/queries)、[pg SSL](https://node-postgres.com/features/ssl)。真實連線的憑證鏈仍待驗證，不能以停用 TLS 驗證解決。

## Schema 與權限

七個 V2 model 與兩個 enum 放在 inventory schema；數量使用 Decimal(18,3)，時間使用 Timestamptz(3)。Item.name 永久唯一；沒有儲存 current stock 欄位。[Prisma multi-schema](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/multi-schema)。

Migration 啟用七張表的 RLS，撤除 PUBLIC、anon、authenticated 的資料存取權限，沒有 browser policy。請關閉 Supabase Data API，且不要將 inventory 加入 exposed schemas。Supabase Auth 仍使用既有 Auth API，本 migration 不修改 auth schema。

目前 runtime 需使用建立資料表的 owner role；若另外配置較小權限角色，必須另行測試 grants/RLS，不可直接換成 anon/authenticated。server-only Prisma singleton 僅共用連線池，不共用使用者 session。尚未接入業務 route；Step 4 authorization 完成前不可部署庫存資料。

## 本機及 migration 命令

```powershell
npm install
npm run db:generate
npm run db:validate
npm test
npm run lint
npm run typecheck
npm run build
```

generate、validate、offline diff 不需要真實 DB。測試以 PGlite 在記憶體中執行 PostgreSQL SQL；它只是 dev dependency，不是 runtime 資料庫，也不是 Supabase 連線或並發測試。[PGlite](https://pglite.dev/docs/)。

建立開發專案並設定 DIRECT_URL 後，先確認目標專案，再執行：

```powershell
npm run db:migrate:status
npm run db:migrate:deploy
npm run db:migrate:status
```

首次 status 可能因尚有 pending migrations 回傳非零，應先檢視原因。Production release 前確認備份、目標環境與權限，以 production 環境變數執行同樣命令；不要誤載入開發 .env.local。Vercel build/postinstall 只 generate，不會 migrate。不要對 production 使用 migrate dev；之後若需要 dev shadow database，必須另行建立隔離資料庫。

initial_inventory 是離線 diff 產物；inventory_integrity 包含手寫 CHECK、history triggers、RLS 和 grants，不能僅靠 schema diff 重建而遺失。StockMove 禁止 DELETE/TRUNCATE；CONFIRMED 不可改寫，錯誤用 reversal。仍需 Step 6–7 服務驗證原交易與 reversal 金額，以及在 server-side transaction 中完成庫存檢查與寫入。

## 依賴修補

package.json 對 Prisma 工具鏈的 deepmerge-ts 8.0.2、mysql2 3.24.3 使用 scoped overrides，修補安裝時的 audit 提示；專案資料庫仍只有 PostgreSQL。更新 Prisma 時重新檢查上游依賴與 override 相容性，不能以 audit fix --force 降級主要版本。
