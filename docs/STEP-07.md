# Step 7 — IN / OUT / reversal、transaction 與 audit

依唯一規格 docs/V2.md 第 11、12、14 節實作。Step 8 盤點尚未實作。

## 修改檔案

- `src/lib/moves/validation.ts`：server 輸入驗證、精確容器換算、請求 UUID 與沖銷原因。
- `src/lib/moves/transaction.ts`：品項／櫃位鎖、請求鎖、庫存重讀、原子寫入與 audit、沖銷及防重送。
- `src/lib/moves/service.ts`：每個讀寫入口重新驗證 allowed-email、預覽、確認與最近異動 DTO。
- `src/app/(workspace)/moves/actions.ts`、`moves/page.tsx`、`moves/in/page.tsx`、`moves/out/page.tsx`：Server Actions 與交易頁面。
- `src/components/move-form.tsx`、`reversal-form.tsx`：手機可操作的預覽／確認、完成收據、沖銷原因與確認。
- `tests/unit/moves-validation.test.ts`、`moves-auth.test.ts`：數量邊界與授權測試。
- `tests/live/moves.test.ts`：真實 Supabase pooler 的並發及回滾驗證。
- `tests/e2e/moves.spec.ts`、`tests/fixtures/db-transport.cjs`、`moves-transport.cjs`、`scripts/test-moves-e2e.mjs`：隔離資料庫的完整瀏覽器交易驗證。
- `package.json`、`playwright.config.ts`、README.md、AGENTS.md、本報告。

## 完成功能

入庫與出庫皆先呼叫 server 預覽，再明確確認。確認時重新驗證登入、輸入、啟用中的品項／櫃位與最新庫存，不信任前端庫存、signedQty、status 或 actorEmail。直接標準數量須大於零，最多 15 位整數與 3 位小數；容器換算使用 BigInt，拒絕超出 precision 或需要四捨五入的結果。

未知每容器數量的 IN 為 NEEDS_REVIEW，normalizedQty 與 signedQty 均為 NULL，不計庫存。OUT 必須知道標準數量。成功後回傳固定三位數量字串、交易編號與狀態。

沖銷新增相反 signedQty 的 CONFIRMED REVERSAL，指向 reversalOfMoveId；原交易保持不變。只允許已確認、非零、非 REVERSAL 原交易，且只能沖銷一次。撤銷入庫也會檢查是否造成負庫存。停用主檔不接受新 IN／OUT，但可更正歷史交易。待確認資料的更正留待 Step 11 Review。

交易採 `ReadCommitted` interactive transaction，順序如下：

1. 取得以 `MV-{UUID}` 雜湊為鍵的 transaction advisory lock，檢查重送。相同 key 與相同內容回傳舊收據，不再寫入 audit；同 key 不同內容拒絕。
2. 取得 `pg_advisory_xact_lock(itemId::int, locationId::int)`，即使該 pair 尚無期初／交易列也可鎖定。這與單一 bigint 的請求鎖屬不同 key space。
3. 用 FOR SHARE 讀取主檔，避免確認期間被同時停用。
4. 在取得鎖後的另一條 SQL statement 重新計算 CONFIRMED 期初＋CONFIRMED 異動。ReadCommitted 讓等待者看見前一交易剛提交的餘量。
5. 拒絕會造成負庫存的減量；StockMove 和 AuditLog 在同一 transaction 寫入並提交。audit 失敗時兩者一起回滾，鎖在 transaction 結束時釋放。

交易 maxWait 5 秒、timeout 15 秒；暫時失敗／回應中斷可用原請求與原內容重試。前端預覽不保證預留庫存。所有 server utilities 保持 server-only，沒有新增 client DB credentials 或 Auth bypass。

## Migration 變更

無新增 migration，Prisma schema 與既有兩份 migration 均不變。使用既有 moveNo unique、reversalOfMoveId unique、歷史不可刪除／已確認不可修改 trigger、RLS 與 browser role 撤權。無 hard delete、無 current stock 欄位。

## 測試命令與結果

2026-09-08 最終驗證：

| 命令 | 結果 |
| --- | --- |
| `npm test` | 20 個測試檔，189 / 189 通過 |
| `npm run db:smoke` | 4 個測試檔，14 / 14 通過；其中 8 項為新增 Step 7 真實交易測試 |
| `npm run test:e2e:moves` | 15 / 15 通過，含桌面與兩種手機尺寸；12 筆 StockMove 對應 12 筆 audit |
| `npm run lint` | 通過，零警告 |
| `npm run typecheck` | 通過，含 Prisma generate、Next typegen、tsc |
| `npm run build` | 通過，/moves、/moves/in、/moves/out 均為動態 server routes |

Windows 本機以 `& 'C:\Program Files\nodejs\npm.cmd'` 執行上述 npm 指令。V2 SHA-256 仍為 `4129374B15254EA63053279324A34AAF26D17B5B063694AF875A15229822DF07`。

初次 E2E 的下拉選單定位未匹配，修正為 accessible combobox role 後全數通過。runner 改以私有 IPC 呼叫 Next 自身關閉流程；最終執行確認伺服器停止、暫存 schema 清除且程序以 exit code 0 結束。

真實並發測試使用新建、隨機命名的 `inventory_test_<32 hex>` 暫存 schema。將既有 SQL migrations 複製至此隔離 schema，僅在測試 pg transport 將 Prisma qualified SQL 導向它；未修改 app runtime 或業務 inventory schema。測試以獨立連線真正 COMMIT，最後 DROP 自行建立的 schema，沒有 DELETE／停用 StockMove 歷史 trigger。

兩筆 OUT 的測試先由第三條連線持鎖，再啟動兩筆請求；以 pg_locks 確認兩筆都在等待後才解鎖。期初 10、同時 OUT 7＋7，只成功一筆，餘量 3，只有一筆 OUT 與 audit。另驗證相同 UUID 重送、未知數量不可供出庫、重複沖銷、負庫存沖銷拒絕、停用主檔、audit 失敗回滾、OUT 與撤銷 IN 同時發生、沖銷重送。

`npm run test:e2e:moves` 需要開發 DATABASE_URL 與本機 Edge，使用 port 3035（若已被占用就中止，不接管既有服務）。runner 自行建立／清除 schema，启动隔離 Auth transport 與真實 Supabase pg transport，驗證桌面、iPhone 13 尺寸、Android 360px 尺寸的登入、主檔回歸及 IN／review-only IN／OUT／沖銷。確認 12 筆測試交易對應 12 筆 audit，然後停止自己啟動的服務並清除 schema。這是 Chromium viewport，並非實體 Safari 或 production Auth smoke test。

## 尚存風險

- Advisory lock 是合作式協議。後續 Step 8 盤點、Step 10 匯入與 Step 11 Review 對庫存的修改必須共用同一鎖定流程；多 pair 須依 itemId、locationId 排序取得鎖。不可直接繞過 service 寫 DB。
- 若關閉整個測試程序或系統突然中斷，finally 可能來不及清除暫存 schema；應辨識本次測試自己建立的 schema 後清理，禁止以模糊條件刪除業務 schema。
- 請求 UUID 只保護相同請求重送；重新整理或建立下一筆會得到新 UUID，使用者仍需核對異動紀錄。
- 未部署 Vercel，未執行 production smoke test；手機外網 HTTPS 與 Windows 關機後可用性仍須等部署階段驗收。

## 下一步

Step 8 Stocktake：選櫃位、讀取最新庫存、輸入實際數量、計算差額；在同一 transaction 依固定順序取得 pair 鎖並重新計算差額，新增 ADJUST_GAIN／ADJUST_LOSS 與 audit，差額零不新增交易。

## 版本與官方依據

- Prisma / adapter-pg 7.10.0、Next.js 16.3.4、pg 8.23.0；本機 Node 24.18.0。
- [Prisma 7 transactions](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions)：interactive transaction、isolationLevel、timeout。
- [PostgreSQL Read Committed](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)：每一 statement 取得新 snapshot。
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)：transaction-level lock 與 key spaces。
- 已閱讀安裝版 `node_modules/next/dist/docs/01-app/02-guides/forms.md`：每個 Server Action 必須自行驗證授權。
