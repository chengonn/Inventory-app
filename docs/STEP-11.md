# Step 11：待確認處理與 Excel 匯出

2026-09-24 實作與測試，2026-09-27 完成收尾。唯一規格來源為未改動內容的 `docs/V2.md`。本步不部署 Vercel，也不提交原始公司 Excel。

## 完成功能

- `/review`：搜尋與分頁、保留原文／來源／原單位，輸入標準數量或容器換算、必填處理原因，Preview → Confirm；可確認或忽略。未知主檔單位必須先修正，不猜換算率。
- 確認只更新 NEEDS_REVIEW 原紀錄，保留來源與完整 before/after audit。IGNORED 不計入庫存；已確認異動仍只能用 reversal 更正。
- Review 使用 request advisory lock 防重送，再取得品項／櫃位 lock 與主檔 SHARE lock；ReadCommitted 鎖後重新讀取庫存並檢查負數。更新、audit、receipt 同一 transaction，任一失敗全部 rollback。
- `/inventory` 匯出符合當前搜尋／低庫存條件的所有頁面；位置搜尋不改變品項全櫃位總量。
- `/moves` 新增搜尋、類型、狀態、台北日期區間與分頁；匯出沿用相同篩選條件，包含所有頁面。
- `/import-export` 可下載庫存、異動與完整 Excel 備份。備份含 Items、Locations、OpeningInventory、StockMoves、NeedsReview、ArchivedRecords、AuditLogs，另含 ImportBatches、Metadata、AuditJson。
- 匯出 endpoint 每次 server-side 驗證使用者；一致的 READ ONLY RepeatableRead snapshot，回應保留更新後的 session cookie，禁止快取。沒有 Auth 密碼、環境設定或憑證匯出。
- 數量以文字保留三位小數與 PostgreSQL Decimal 精度。使用者文字一律是 literal string cell，不建立公式或超連結。長 audit JSON 分段保留，不截斷資料。

## 修改檔案

- `src/lib/review/{validation,transaction,service}.ts`、`src/app/(workspace)/review/{page.tsx,actions.ts}`、`src/components/review-form.tsx`。
- `src/lib/exports/{data,workbook}.ts`、`src/app/api/export/route.ts`、`src/components/{export-button,export-panel}.tsx`。
- `src/lib/moves/{filter,browse}.ts`、`src/components/move-filters.tsx`；調整 inventory、moves、import-export 頁面。
- 新增 `tests/unit/{review,review-auth,export,export-route}.test.ts` 與 `tests/e2e/review-export.spec.ts`；擴充 `tests/live/moves.test.ts`、E2E runner、Playwright config、package scripts。
- `README.md`、`AGENTS.md`、本報告。

Step 10 未提交的匯入檔案仍在工作目錄，見 STEP-10.md；沒有替使用者 commit 或 push。

## Migration

無新增 schema 或 migration；沿用既有 status 與 AuditLog 儲存 Review receipt。兩份已套用 migration 的原始 checksum 與 V2 原文必須維持不變。工作目錄中 migration 的換行修復與 `.gitattributes` 屬 Step 10，並非本步 SQL 變更。

## 驗證

| 命令 | 結果 |
|---|---|
| `npm test` | 271 passed，1 項私人 Excel 來源檢查 skipped |
| `npm run db:smoke` | 36 passed，2 項選用私人來源檢查 skipped |
| `npm run test:e2e:review` | 27 項完整回歸通過；最後一次 Playwright 記錄 status=passed、failedTests=[] |
| `npm run lint` | 通過，0 warnings |
| `npm run typecheck` | 通過 |
| `npm run build` | 2026-09-27 通過；review 與 export 均為動態 server routes |

Windows 可改用 `& 'C:\Program Files\nodejs\npm.cmd'`。真實 DB 測試包含 Review 與一般出庫並發只成功一筆、重送防重複、audit 失敗 rollback、未知單位拒絕、忽略保留原文、51 筆跨頁匯出、長 JSON 與精確數量的 XLSX round trip。測試寫入限自建暫存 schema，完成後移除。

E2E 為 Edge Chromium 桌面、iPhone 13 尺寸與 Android 360px；不是實體 Safari 或 production 驗收。第一輪桌面測試選取下拉欄位逾時，已加入明確 aria-label 並修正定位方式後重跑；未忽略失敗。

## 使用與備份限制

1. 匯入原始 Excel：在 App 的「Excel 匯入／匯出」上傳原始檔，核對逐筆預覽與警告後勾選並確認。之前唯讀檢查的 40 筆已確認／143 筆待確認不是已匯入結果。2026-09-24 開發庫唯讀檢查 ImportBatch 仍為 0。
2. 待確認：逐筆核對原文與實物，必要時先在品項管理設定標準單位，再預覽、確認；未知量不能支撐出庫。
3. 備份：登入後按「下載完整 Excel 備份」，保存至受控位置。此為完整業務資料匯出格式，不是 Step 10 四表匯入模板；目前沒有自動還原 endpoint。
4. AuditLogs 的 beforeJson／afterJson 若為 `@AuditJson:<id>:<field>`，到 AuditJson 依 auditId、field 分組、part 遞增串接 jsonChunk，確認 parts 完整後 JSON.parse；原始 JSON 未被省略。
5. 單次 workbook 最多 10000 資料列（包含各表、待確認重列及 JSON 分段）、序列化資料 8 MiB、成品 4 MiB；完整備份先限制 audit JSON 6 MiB。超限回明確錯誤，不提供截斷的「完整」備份。更大量資料應使用管理員 PostgreSQL 備份流程。
6. Excel 不包含 Supabase Auth 或平台設定，也不取代資料庫備份／復原演練。Supabase 自動備份、保留期間與 PITR 需依實際方案確認；本步未購買或變更平台備份設定。

## 官方依據

- [SheetJS write options](https://docs.sheetjs.com/docs/api/write-options/) 與 [output](https://docs.sheetjs.com/docs/solutions/output/)，使用已安裝 0.20.3。
- Next.js 16.3.4 本機 `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`。
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)。

## 下一步

Step 12：Vercel 環境與部署，區分 Preview／Production 的 DB 與 mutation 權限，核對 pooled runtime／migration connection、Auth URL、環境變數及 HTTPS，再進行 production smoke test。尚未提供電腦關機後仍可用的正式雲端網址。
