# Step 3 — Prisma PostgreSQL（2026-09-07）

> 2026-09-08 更新：Supabase 開發專案已建立，兩份 migration 已套用，runtime pooled connection 與完整 4 項雲端 smoke test 已通過。最新狀態見 [真實連線報告](STEP-03-LIVE.md)。以下未設定專案的敘述為先前離線階段紀錄。

程式與本機驗證完成。**Supabase project 尚未建立，migration 尚未套用 Supabase；未驗證真實 pooled connection，也尚未部署 Vercel。**

## 修改檔案

- package.json、package-lock.json：鎖定 Prisma/client/adapter-pg 7.10.0、pg 8.23.0，加入 generate、validate、migration scripts 與工具鏈 scoped overrides。
- prisma/schema.prisma、prisma.config.ts：V2 七個 model、兩個 enum 與 CLI 設定。
- prisma/migrations/migration_lock.toml、202609070001_initial_inventory/migration.sql、202609070002_inventory_integrity/migration.sql。
- config/database.ts、src/lib/prisma.ts、scripts/require-migration-env.mjs：URL 分流驗證、server-only pg adapter、migration 前置檢查。
- .env.example、.gitignore、eslint.config.mjs：設定說明、排除 generated client。
- tests/unit/database-config.test.ts、prisma-client.test.ts、prisma-config.test.ts。
- tests/integration/inventory-schema.test.ts、prisma-offline.test.ts、prisma-runtime.test.ts。
- README.md、AGENTS.md、docs/DATABASE-SETUP.md、本報告。

src/generated/prisma 為 generate 產物，不提交。docs/V2.md 原文未更動。

## 完成功能

Runtime 僅接受 shared transaction pooler 6543；CLI 使用 direct/session 5432，無互相 fallback。Prisma 7 使用 pg adapter 與明確 TLS 驗證，連線池預設 2；client 延遲建立且僅 server 可用。沒有在 request/build 中自動 migration。

Schema 使用 inventory namespace、Decimal(18,3)、Timestamptz(3)；保留 V2 原始值與 review 欄位，不儲存 current stock。完整設定與官方來源見 [DATABASE-SETUP.md](DATABASE-SETUP.md)。

## Migration 變更

1. initial_inventory：離線 Prisma diff 產生 schema、enum、七張表、索引與外鍵。
2. inventory_integrity：數值/status CHECK、SHA-256 格式、StockMove 禁止 hard delete/TRUNCATE 與 CONFIRMED 改寫；七表 RLS，撤除 browser roles 存取。

NEEDS_REVIEW normalized quantity 必須為 null。IGNORED 可保留歷史解析值，但後續庫存聚合只採 CONFIRMED。Reversal 有唯一原交易參照，服務層仍須驗證金額一致。手寫 SQL 必須保留於 migration history。

## 測試命令與結果

| 命令 | 結果 |
| --- | --- |
| npm run db:generate | 通過，Prisma client 7.10.0 |
| npm run db:validate | 通過 |
| npm test | 12 個檔案、98 項通過 |
| npm run lint | 通過，零 warnings |
| npm run typecheck | 通過 |
| npm run build | 通過 |
| E2E_UNCONFIGURED=1、E2E_BASE_URL=http://127.0.0.1:3033，npm run test:e2e | 3/3 通過，未設定狀態 HTTP 503 |
| npm audit | 0 vulnerabilities（加入 scoped overrides 後） |

Windows 使用 C:\Program Files\nodejs\npm.cmd，避免失效的 Roaming npm 路徑。E2E 使用獨立 production test server；測試後已停止 3033，沒有停止使用者的 3000 服務。

測試涵蓋真實 generated client/adapter 的離線建構、CLI diff 與初始 SQL 一致、缺少 DIRECT_URL 時 migration 前置檢查中止，以及 PGlite 執行兩份 SQL 後的 decimal、唯一鍵、外鍵、history trigger、RLS/grants 與 SHA-256 約束。這些不代表 Supabase migration 已成功。

## 尚存風險

- 尚待真實專案驗證密碼、TLS 憑證鏈、角色權限、pooler 與 migration 狀態。
- PGlite 為單連線記憶體 PostgreSQL 測試，未驗證 Supabase 或多請求並發。
- 庫存聚合、出庫 transaction、盤點、完整 reversal 與 Excel Preview → Confirm 尚在後續步驟；目前 schema 不足以單獨防止負庫存。
- Auth allowed-email guard 尚未完成，不可上線業務資料。
- scoped overrides 經本機驗證；升級 Prisma 時仍需重新核對相容性。

## 下一步

建立 Supabase 開發專案後，依 DATABASE-SETUP.md 填入實際連線資訊，執行 migration 並驗證真實連線。Step 4 才實作完整登入、登出與 server-side allowed-email guard；本步未提前加入。
