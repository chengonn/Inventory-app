# Step 8 — 盤點（2026-09-17）

依唯一規格 `docs/V2.md` 第 13 節：選櫃位、讀取 server current stock、輸入實際數量、鎖定後重算差額，於一次 transaction 寫入盤盈／盤損與 audit。Step 9 尚未開始。

## 修改檔案

- `src/lib/stocktake/validation.ts`：非負實際數量、空白／零區分、重複品項、最多 50 筆與請求 UUID 驗證；BigInt 精確差額，拒絕 numeric(18,3) 溢位。
- `src/lib/stocktake/transaction.ts`：整批鎖定、鎖後庫存重讀、ADJUST_GAIN／ADJUST_LOSS、StockMove audit 與盤點收據 audit、防重送。
- `src/lib/stocktake/service.ts`：授權入口、櫃位盤點表、server preview 與 confirm。
- `src/app/(workspace)/stocktake/page.tsx`、`actions.ts`、`src/components/stocktake-form.tsx`：手機表單、預覽確認、鎖後實際結果與紀錄入口。
- `src/lib/moves/{validation,transaction,service}.ts`：匯出既有驗證、授權與鎖定 helper，讓盤點共用 Step 7 協議；未新增 Auth bypass。
- `tests/unit/stocktake.test.ts`、`tests/live/moves.test.ts`、`tests/e2e/stocktake.spec.ts`、`tests/e2e/auth.spec.ts`：數量／授權、真實並發與完整操作測試。
- `scripts/test-moves-e2e.mjs`、`playwright.config.ts`、`package.json`：擴充隔離 E2E fixtures 與資料庫 audit 驗證，新增 `test:e2e:stocktake` 指令（也執行既有登入／主檔／入出庫回歸）。
- README.md、AGENTS.md、本報告。

## 完成功能

選取啟用中的櫃位後，列出啟用品項與該櫃位的已確認庫存。只加總 CONFIRMED OpeningInventory 與 StockMove；NEEDS_REVIEW／IGNORED 不計入。未填欄位不參與本次盤點，0 是明確實際零數量。一次提交同一櫃位 1–50 個品項；其他品項不受影響。

預覽只讀取資料，不建立任何交易。確認入口重新驗證 Supabase allowed-email 與輸入，取得請求鎖後，依 itemId 排序取得所有品項＋櫃位的 transaction advisory locks。這些鎖與 Step 7 IN／OUT／reversal 相同。使用 ReadCommitted，在取得鎖之後的另一條 SQL statement 重新計算 current stock，不信任瀏覽器傳來的庫存或差額。

每筆差額為 `actual - locked current`：正值建立 CONFIRMED ADJUST_GAIN，負值建立 CONFIRMED ADJUST_LOSS，零不建立 StockMove。差額與數量使用十進位字串／BigInt，不轉浮點數。主檔 FOR SHARE 防止提交期間被停用。任何品項驗證、交易插入或 audit 失敗會令整批回滾。

每筆調整都有 StockMove audit，記錄確認時餘量、actualQty、盤點請求與實際 actorEmail。另在同一 transaction 建立 `entityType=Stocktake, action=STOCKTAKE, entityId=ST-{UUID}` 的 audit，保存已驗證輸入及最終收據。即使全批差額零，也保留此盤點 audit；沒有建立零數量 StockMove。

相同 UUID 重送會在請求鎖後比對原內容，回傳既有收據，不重新把庫存設回舊實際數量。相同 UUID、不同內容拒絕。JSONB 不保留物件 key 順序，因此比對明確欄位，不能直接對資料庫 JSONB 做 JSON.stringify 字串比較。盤點收據 audit 是防重送紀錄，不可任意清除。

完成畫面顯示鎖定時的庫存、實際數量與最終差額；可能不同於預覽。盤點調整可透過 Step 7 reversal 更正，原歷史保留。

## Migration 變更

無。未修改 Prisma schema 或既有兩份 migration。沿用 StockMove、AuditLog、交易編號 unique、既有歷史保護 trigger 及 RLS。盤點收據使用既有 AuditLog JSON 欄位與請求鎖，不另建庫存餘額表。

## 測試命令與結果

2026-09-17 最終驗證全部通過：

| 命令 | 結果 |
| --- | --- |
| `npm test` | 21 個測試檔，203 / 203 通過 |
| `npm run db:smoke` | 4 個測試檔，22 / 22 通過，含 8 項新增盤點真實交易測試 |
| `npm run test:e2e:stocktake` | 18 / 18 通過，桌面、iPhone 13 尺寸、Android 360px |
| `npm run lint` | 通過，零警告 |
| `npm run typecheck` | Prisma generate、Next typegen、tsc 全數通過 |
| `npm run build` | 通過，`/stocktake` 為動態 server route |

E2E 後核對 18 筆 StockMove、18 筆 StockMove audit、6 筆 Stocktake 收據 audit；其中每種 viewport 包含一次有差額及一次零差額盤點。隔離伺服器正常停止、暫存 schema 清除，runner exit code 0。Windows 本機使用 `& 'C:\Program Files\nodejs\npm.cmd'` 執行以上 npm 指令。

新增真實 DB 測試：盤盈／盤損／零差額同批、零差額收據防止重送覆蓋後續 OUT、等待未提交 OUT 後重算、同請求並發重送、多品項反向輸入順序、batch audit 失敗全回滾、後段停用品項令前段回滾、未知數量排除與調整 reversal。

真實並發情境：期初 10，OUT 7 在未提交 transaction 內持鎖，啟動實際數量 5 的盤點；透過 pg_locks 證明盤點正在等待，OUT 提交後盤點讀到 3，建立 ADJUST_GAIN +2，最終為 5。

E2E 使用隔離 Auth transport＋真實 Supabase 暫存 schema，涵蓋桌面、iPhone 尺寸、Android 360px；驗證選櫃位、非法負數、預覽不寫入、返回修改、同批盤盈／盤損／無差額、空白不參與、全零差額提交及異動紀錄。不是實體 Safari 或 production smoke test。

本次開發資料庫最初回報 `tenant/user not found`，既有 Step 7 smoke 也失敗。控制台確認 `inventory-v2-dev` 處於 paused；恢復既有專案後才能重跑。沒有重設密碼、升級付費方案、替換連線字串或重新建立資料庫。首次失敗／跳過的測試不計為驗證成功。

## 尚存風險

- 盤點實際數量是人員在某個時間點的實物觀測；交易鎖無法防止人員搬動貨物。UI 提醒暫停搬動或重新清點，待確認實物需核對來源，避免重複計數。
- 每批最多 50 筆；transaction timeout 15 秒，鎖等待或網路延遲超時時會全批回滾，請以相同請求重試。重新載入會產生新請求，結果不明時應先核對異動紀錄。
- 後續 import／Review 必須共用 pair 鎖與排序規則，不能直接繞過 service 寫庫存。AuditLog 的盤點收據不可刪除，否則失去零差額請求的防重送記憶。
- 暫存測試 schema 僅在 finally 清除自己建立的名稱；系統突然中止仍可能需要核對並清理該次殘留 schema。
- Vercel 部署、真實手機 Internet＋HTTPS 與 production smoke 仍在後續步驟；Supabase 專案暫停會影響服務可用性，正式部署時需納入方案與維運考量。

## 下一步

Step 9 Dashboard／Query：dashboard、搜尋、低庫存，依 V2 繼續逐步實作並驗證；不在本步開始。

## 依據

- V2 原文 SHA-256：`4129374B15254EA63053279324A34AAF26D17B5B063694AF875A15229822DF07`，未變更。
- 安裝版 Next.js 16.3.4 `node_modules/next/dist/docs/01-app/02-guides/forms.md`：每個 Server Action 自行驗證授權。
- Prisma 7.10.0 / pg 8.23.0 沿用 Step 7 官方 transaction／advisory lock 做法，參閱 [Step 7](STEP-07.md)。
- [Supabase shared pooler 錯誤說明](https://supabase.com/docs/guides/troubleshooting/tenant-or-user-not-found) 與 [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)。

