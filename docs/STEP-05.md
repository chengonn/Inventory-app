# Step 5 — 品項與櫃位主檔（2026-09-08）

Step 4 已驗收後才開始本步。Step 5 已完成主檔新增、查詢、編輯、停用與重新啟用；庫存計算、交易、盤點、Excel 匯入與部署均未提前加入。

## 修改檔案

- src/lib/master-data/validation.ts：欄位、類型、編號與版本驗證。
- src/lib/master-data/service.ts：每次讀写皆驗證 actor、Prisma 查詢、transaction 儲存及 AuditLog。
- src/app/(workspace)/items/page.tsx、items/actions.ts、locations/page.tsx。
- src/components/master-page.tsx、master-form.tsx：搜尋、狀態篩選、每頁 50 筆、響應式新增／編輯表單與錯誤提示。
- src/app/(workspace)/dashboard/page.tsx、[...section]/page.tsx：更新目前功能狀態文字。
- tests/unit/master-validation.test.ts、master-service.test.ts：21 項新測試。
- tests/live/master-data.test.ts：真實 PostgreSQL service 整合，全部寫入放在最後回滾的 transaction。
- tests/e2e/master.spec.ts、playwright.config.ts：三種螢幕尺寸的主檔與驗證錯誤 E2E。
- README.md、AGENTS.md、本報告。

## 完成功能與規則

品項欄位：名稱、單位、安全庫存、備註、啟用狀態。櫃位欄位：區域、櫃號、顯示名稱、備註、啟用狀態。名稱去除首尾空白後，沿用資料庫既有永久唯一規則；區域＋櫃號沿用複合唯一鍵。唯一性依目前 PostgreSQL 字串比較，不另做全半形或大小寫合併。

安全庫存空白存 NULL，不當成零；只接受非負十進位數，最多 15 位整數與 3 位小數，不經浮點數換算。server 驗證字串長度、必填、ID、日期版本、boolean，不信任 client 驗證。

删除採停用策略：本步不提供 hard delete，保留所有歷史參照。停用後可搜尋「停用／全部」並重新啟用原記錄；預設列表只顯示啟用。未來交易下拉仍須明確篩選 isActive=true，不能把本步視為已實作交易選單。

所有讀写服務向 Supabase Auth getUser 驗證白名單；actorEmail 從已驗證 actor 取得，不採信 form。每次儲存與 before/after AuditLog 位於同一 transaction。編輯以 id＋updatedAt 比對，資料已更新則拒絕提交並要求重新整理，不覆蓋另一分頁的修改。

表單保留錯誤輸入值；狀態改為停用並儲存即完成停用。畫面預設啟用篩選時該列會消失，可切換篩選查回。新增成功後會刷新列表，受當前搜尋條件影響。

## Migration 變更

無新增或修改 migration。使用 Step 3 既有 Item、Location、AuditLog、唯一鍵與外鍵，V2.md 原文未修改。

## 測試命令與結果

| 命令 | 結果 |
| --- | --- |
| npm test | 16 個檔案，140/140 通過 |
| npm run lint | 通過 |
| npm run typecheck | 通過 |
| npm run build | 通過 |
| npm run db:smoke | 2 個檔案，5/5 通過 |
| E2E_BASE_URL=http://127.0.0.1:3035、E2E_AUTH_FIXTURE=1，npm run test:e2e -- --workers=1 | 12/12 通過，桌面、iPhone 尺寸與 Android 尺寸 |

真實資料庫測試執行 service 的新增、修改、停用、重新啟用、過期版本拒絕，核對六筆 audit 後主動 rollback，並從 transaction 外確認測試品項／櫃位筆數為零。測試沒有提交主檔與 AuditLog，但 PostgreSQL sequence 可能消耗編號，編號不保證連續。

注意：從本步開始 db:smoke 除 Step 3 的唯讀檢查外，另含最後回滾的主檔寫入測試，僅對開發專案執行。該測試用固定的已授權 actor fixture 隔離 Auth；真正身分守衛由 unit/Step 4 驗收覆蓋。不能宣稱真實帳號已在瀏覽器操作完整 CRUD。

E2E 使用隔離 Auth transport、真實開發 DB 查詢，測試主檔搜尋、手機排版與安全庫存 -1 的 server-side 拒絕，不提交測試資料；登入／登出與白名單拒絕一併回歸。3035 為獨立 dev 測試服務，測後已停止；不是 Vercel production test。

## 尚存風險與下一步

- 尚未做實體 iPhone Safari 驗收；手機 E2E 是 Chromium viewport。
- 修改已被交易引用的名稱會影響未來依主檔 join 顯示的名称，原交易與 audit 仍保留；沒有硬刪除。
- 樂觀版本檢查用於主檔，不代表已實作並發出庫防負庫存。
- 目前仍需啟動本機服務，沒有 Vercel Internet＋HTTPS 上線網址。

下一步為 Step 6 Inventory service：依 V2 計算 OpeningInventory（CONFIRMED）＋CONFIRMED StockMoves，NEEDS_REVIEW 不計入 normalized stock。
