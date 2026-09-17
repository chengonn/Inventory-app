# Step 6 — Inventory service（2026-09-08）

依 V2 第 10 節完成庫存計算服務：CONFIRMED OpeningInventory.normalizedQty ＋ CONFIRMED StockMove.signedQty。沒有建立 currentQuantity 欄位、快取庫存表或庫存写入 endpoint。

## 修改檔案

- src/lib/inventory/query.ts：參數化 SQL、Item＋Location 彙總、同品項全櫃位總數、交易內讀取 helper 與 ID 驗證。
- src/lib/inventory/service.ts：查詢前驗證 Supabase Auth 白名單；回傳精確 Decimal 字串 DTO。
- tests/unit/inventory-service.test.ts：12 項權限、輸入、DTO 精度及 transaction helper 測試。
- tests/integration/inventory-calculation.test.ts：11 項實際 PostgreSQL SQL 測試（PGlite）。
- tests/live/inventory.test.ts：真實 Supabase pooler / Prisma Decimal 計算及 rollback 測試。
- README.md、AGENTS.md、本報告。

## 完成功能

`calculateStock(itemId?)` 為 server-only 授權入口。回傳 locations（itemId、locationId、openingQty、movementQty、currentQty）及 items（itemId、currentQty）；數量固定三位小數字串，避免 JSON number 精度流失。可指定單一品項，未指定則回傳所有有已確認流水的品項／櫃位。

SQL 先 UNION ALL 兩份流水，再按 Item＋Location GROUP BY，最後用 window SUM 算同品項所有櫃位總数。全部在一個 SQL statement 的 snapshot 中讀取，避免分兩次查詢時看見不同資料狀態，也避免明細直接 join 導致倍增。SUM 由 PostgreSQL numeric 計算，不轉 Float 或 JavaScript number。

- NEEDS_REVIEW、IGNORED 均不計入，包含 IGNORED 保留了已解析數量的情況。
- ArchivedRecord 不納入庫存。
- CONFIRMED reversal 按 signedQty 加總，保留原交易；不因存在 reversal 而再次排除原交易。
- 不篩除停用 Item／Location，以保留歷史庫存。
- 確認流水加總為零的 pair 保留；只有 NEEDS_REVIEW 或完全沒有確認流水的 pair 不虛構為實體零庫存。
- 負餘額如實回傳，供後續診斷；不 clamp 為零。

`readLocationStock(tx, itemId, locationId)` 僅供後續已授權的 server transaction service 使用，使用傳入的 Prisma.TransactionClient，不另開連線或 transaction；沒有確認流水時回 Decimal 0，僅表示 normalized balance。**此 helper 不鎖資料、不驗證 actor，不可直接作為 API；Step 7 必須先授權與取得一致的 pair lock，再讀取、檢查、寫入。**

## Migration

無新增／修改 migration。使用既有 OpeningInventory、StockMove 與索引；沒有改動 V2.md 原文。

## 測試命令與結果

| 命令 | 結果 |
| --- | --- |
| npm test | 18 個測試檔，163/163 通過 |
| npm run db:smoke | 3 個測試檔，6/6 通過 |
| npm run lint | 通過 |
| npm run typecheck | 通過 |
| npm run build | 通過 |

SQL 測試涵蓋：多筆期初與異動避免倍增、同品項兩櫃位合計、兩品項不混算、NEEDS_REVIEW 與 IGNORED 排除、reversal、盤盈盤虧、只有異動的 pair、負數、確認零、停用主檔、待確認轉確認、封存排除與大數精度。

真實 Supabase 測試在同一 transaction 寫入 0.100＋0.200 的期初、-0.125 出庫、另一停用櫃位 5.000，以及 review/ignored 對照。查詢得到 0.175 與 5.000，品項總量 5.175；helper 也回傳 0.175。最後主動 rollback，並在 transaction 外確認測試 Item 與 StockMove 為零筆。沒有 hard delete StockMove，沒有提交測試交易；sequence 可能消耗編號。

本步沒有 UI 變更或新增 endpoint，因此不重跑瀏覽器 E2E。主檔與 Auth E2E 沿用 Step 5 已通過結果，不能把它當成本步新增庫存 UI 的驗收。

## 尚存風險與下一步

- 尚未實作並發出庫鎖定與負庫存防護；單一讀取 snapshot 不等於安全的 read-check-write。
- 全量結果未分頁，適合目前單人內部資料規模；後續庫存查詢 UI 如需分頁，必須保留品項總量仍為全櫃位總和的語意。
- 尚未將本服務接入庫存查詢畫面或 dashboard，這些仍依 V2 後續步驟完成。
- 真實 DB smoke 是最終 rollback 的測試，僅對開發專案執行。

下一步：Step 7 IN／OUT／reversal＋server-side transaction＋audit，加入避免並發負庫存的鎖定策略與測試。
