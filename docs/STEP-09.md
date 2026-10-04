# Step 9 — Dashboard／搜尋／低庫存（2026-09-17）

依唯一規格 `docs/V2.md` 第 8、10 節與 Step 9 實作，未開始 Step 10 Excel import。

## 修改檔案

- `src/lib/inventory/read-model.ts`：查詢參數、台北日期區間、品項與櫃位 DTO、精確低庫存比較、搜尋與分頁。
- `src/lib/inventory/browse.ts`：server-only 授權入口、唯讀一致快照、dashboard 六項統計與最近 10 筆異動。
- `src/app/(workspace)/dashboard/page.tsx`：以真實資料取代 placeholder，加入搜尋、統計、快速操作、低庫存入口及最近異動。
- `src/app/(workspace)/inventory/page.tsx`、`src/components/inventory-search.tsx`：手機搜尋、櫃位明細、低庫存篩選、空結果、錯誤訊息及分頁。
- `tests/unit/inventory-browse.test.ts`、`tests/live/moves.test.ts`、`tests/e2e/query.spec.ts`：計算與過濾、權限、真實 SQL／快照、桌面與手機完整查詢驗證。
- `scripts/test-moves-e2e.mjs`、`playwright.config.ts`、`package.json`：擴充隔離 fixtures 與 `test:e2e:query` 指令；仍含 Step 4–8 回歸。
- README.md、AGENTS.md、本報告。

## 完成功能與統計定義

Dashboard 顯示品項總數、有庫存品項數、低於安全庫存品項數、待確認筆數、今日入庫／出庫筆數，以及依 occurredAt DESC、id DESC 排序的最近 10 筆異動。快速搜尋與 `/inventory` 搜尋皆接受品項名稱、區域、櫃號的字面部分比對，英文不分大小寫；不將 `%`、`_` 解釋為 SQL wildcard。

沿用 Step 6 的 `stockQuery()`，只計 CONFIRMED OpeningInventory＋CONFIRMED StockMove；保留 reversal 的正負值，不再額外排除原交易。沒有新增餘額欄位或另一份計算公式。數量以固定三位十進位字串傳遞，安全庫存以 BigInt 千分位比較，避免 JavaScript 浮點精度問題。

- 品項總數包含停用品項；歷史櫃位不因停用被排除。UI 清楚標示停用。
- 有庫存品項＝所有櫃位已確認總量大於 0；零與負值不計為有庫存。
- 低庫存＝全櫃位已確認總量嚴格小於已設定安全庫存。等於安全庫存不算低；null 為未設定、不算低；安全庫存 0 仍有意義。
- 無確認流水的品項以已確認帳面 0 顯示，同時標示「尚無已確認庫存紀錄」，不是實物為零的聲明。只含待確認資料的櫃位不偽造 CONFIRMED 流水。
- 待確認筆數＝OpeningInventory 與 StockMove 的 NEEDS_REVIEW 筆數；IGNORED、ArchivedRecord 不納入庫存或此待確認計數。
- 今日以 Asia/Taipei 的 UTC+8 日期 `[當日 00:00, 次日 00:00)` 計算，只統計 CONFIRMED IN／OUT；reversal、adjustment 不當成新的 IN／OUT，原交易不因沖銷而抹除活動筆數。
- 搜尋櫃位時僅縮小顯示的櫃位明細，品項總量與低庫存判定仍使用所有櫃位。品項名稱匹配時顯示該品項全部相關櫃位。
- 先搜尋／低庫存篩選再按品項分頁，每頁 20 個品項；分頁保留條件，超出頁碼回到最後一頁，空結果顯示明確提示。

每個公開 service 入口先重新驗證 allowed-email，再開啟 `RepeatableRead`、`SET TRANSACTION READ ONLY` 的 Prisma transaction。主檔、期初／異動彙總、待確認資料、今日筆數及最近異動使用同一 snapshot，避免不同 SQL 看見互相矛盾的資料。寫入流程仍沿用 Step 7–8 的 ReadCommitted＋pair locks，沒有改動。父層 force-dynamic 與既有 session/no-store 機制保留。

DB 錯誤顯示通用重試／登入訊息，不把失敗當成零庫存，不輸出連線或憑證。此步沒有新增寫入 endpoint。

## Migration 變更

無。Prisma schema、兩份 migration 與既有 RLS／歷史保護均未變更。

## 測試命令與結果

2026-09-17 最終驗證全部通過：

| 命令 | 結果 |
| --- | --- |
| `npm test` | 22 個測試檔，218 / 218 通過 |
| `npm run db:smoke` | 4 個測試檔，24 / 24 通過 |
| `npm run test:e2e:query` | 21 / 21 通過；桌面、iPhone 13 尺寸、Android 360px |
| `npm run lint` | 通過，零警告 |
| `npm run typecheck` | Prisma generate、Next typegen、tsc 全部通過 |
| `npm run build` | 通過，`/dashboard`、`/inventory` 均為動態 server route |

E2E 最終核對既有交易回歸產生 18 筆 StockMove、18 筆對應 audit、6 筆盤點收據 audit，查詢流程沒有新增交易。隔離 server 已停止，暫存 schema 已清除，runner exit code 0。Windows 使用 `& 'C:\Program Files\nodejs\npm.cmd'` 執行上述指令。

本機測試驗證跨櫃位低庫存、等於／未設定／零安全庫存、負值與高精度、待確認及無確認流水、停用歷史、字面搜尋、分頁、URL 參數、台北午夜與匿名／非白名單阻擋。

新增 2 項真實 Supabase 測試：1. 比對 dashboard 數值、今日邊界、跨櫃位總量、待確認及最近異動；2. 讀取 snapshot 後，另一連線提交 IN，原 transaction 仍看見一致舊庫存，下一次 snapshot 才看見新值。使用既有 disposable schema，不修改業務庫存。

E2E 新增固定查詢 fixtures：全櫃位 10（某櫃位只有 1）、低庫存品項、待確認品項、無紀錄品項及 21 筆分頁品項。桌面與兩種手機尺寸都驗證 dashboard 六項指標、三種搜尋、低庫存、未知／零提示、分頁與空結果；並重跑登入／主檔／入出庫／盤點。

## 尚存風險

- 現階段於 server snapshot 讀取彙總與主檔後，在 server 記憶體中搜尋與分頁，僅把當頁 DTO 渲染給瀏覽器；適用目前單人內部規模。若資料量顯著增長，應將搜尋與分頁下推 SQL 並量測效能，保持全櫃位總量及一致快照定義。
- 本步只讀；待確認更正仍在 Step 11，Excel 匯入在 Step 10。沒有把 placeholder Review／匯入頁宣稱為已完成。
- 手機測試為 Chromium 的 iPhone／Android 尺寸，非實體 Safari。Vercel、網域 HTTPS、production smoke 仍待 Step 12–13。

## 下一步

Step 10 Excel import：Preview → validation → SHA-256 防重複 → transaction commit，並遵守既有庫存鎖定協議。

## 依據

- `docs/V2.md` 原文未修改，SHA-256 仍為 `4129374B15254EA63053279324A34AAF26D17B5B063694AF875A15229822DF07`。
- 已閱讀安裝版 Next 16.3.4 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` 的 async searchParams 與 Server Component 規範。
- Prisma 7.10.0 / adapter-pg 沿用既有連線設定；[PostgreSQL Repeatable Read](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-REPEATABLE-READ) 說明同一 transaction 的一致快照。

