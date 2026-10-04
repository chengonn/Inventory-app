# Step 10 — Excel 預覽與確認匯入（2026-09-18）

依 V2 第 16 節完成 `/import-export`。僅在使用者預覽、勾選並按「確認匯入」後寫入業務資料。實際來源檔已通過唯讀預覽，尚未 commit；Step 11 Review／Export 尚未開始。

## 修改檔案

- `src/lib/imports/model.ts`：Zod 4.6.5 匯入計畫 schema、型別與摘要。
- `src/lib/imports/zip.ts`、`parse.ts`：server-only SheetJS 解析、XLSX／壓縮大小檢查、來源欄位驗證、精確數量與台北日期、SHA-256。
- `src/lib/imports/transaction.ts`：預覽資料庫檢查、ordered advisory locks、鎖後重讀庫存、整批建立與 audit。
- `src/lib/imports/service.ts`：每個入口重新驗證 allowed actor；伺服器預覽收據、確認與最近 20 次匯入紀錄。
- `src/app/(workspace)/import-export/{page.tsx,actions.ts}`、`src/components/import-form.tsx`：上傳、主檔與逐筆預覽、錯誤／提醒、20 筆分頁、勾選確認、結果、手機版。
- `next.config.ts`：Server Action body limit 4 MB，業務檔案限制 3 MB。
- `package.json`、`package-lock.json`：官方 SheetJS 0.20.3、Zod 4.6.5 與 `test:e2e:import`。
- `tests/unit/import-{parse,auth}.test.ts`、`tests/fixtures/import-workbook.ts`：不含公司資料的 XLSX fixture、解析、防護與權限測試。
- `tests/live/moves.test.ts`、`tests/live/import-source.test.ts`：真實 DB 防重複、並發 OUT、rollback、過期／錯誤 actor／版本驗證，以及選用的來源唯讀預覽。
- `tests/e2e/import.spec.ts`、`playwright.config.ts`、`scripts/test-moves-e2e.mjs`：桌面與兩種手機尺寸的完整匯入驗收、暫存 schema 清除。
- `.gitattributes`、既有 migration 的原始換行恢復、README、AGENTS 與本報告。

## 匯入語意

1. 四張必要工作表：品項設定、InventoryData、StockMoves、移除紀錄。驗證前 10 列中的固定欄位名稱與順序；缺表／缺主檔／重複品項／重複單號／無效日期為阻擋錯誤。僅含衍生公式的模板空列不匯入，孤立輸入欄不會悄悄略過。
2. 不採用任何 Excel 公式快取。輸入欄拒絕公式；衍生總數、增減、公式狀態忽略，使用 BigInt 千分位重新計算。未知換算、來源待確認、未知單位或與主檔單位不一致，保存 NEEDS_REVIEW 與 NULL quantity，不硬換算為 0。IGNORED 保留且不計庫存。
3. StockMoves 只接受 IN／OUT／ADJUST_GAIN／ADJUST_LOSS（含對應中文）。reversal 使用 App 原有流程。日期採台北時間；空白單號以完整 hash＋Excel 列號產生。缺櫃號明確映射「未編號」並顯示提醒，來源留在 note。
4. 移除紀錄只存 ArchivedRecord，不產生出庫、不影響現有庫存。保留原文、位置、原狀態與移除原因。
5. 既有主檔不覆寫安全庫存／備註、不自動啟用。既有主檔單位不同會阻擋。已有期初的 item/location 禁止再疊加期初；即使修改檔案 hash 也不能重複加入同一組期初。
6. 確認前按日期、同日按來源列排序檢查 StockMoves，任何 confirmed 出庫／盤損造成負庫存均整批拒絕。Review 不能支撐出庫。

## 預覽與交易安全

- actor 驗證在解析／DB 存取之前。沿用 Server Action Origin 防護與 session cookie 政策，沒有新增 client DB／service-role key。
- 上傳上限 3 MB、實際資料總計 2000 列、解析計畫 1 MB；ZIP 最多 500 entries、單 entry 解壓 16 MB、合計 32 MB。實際有界解壓後才交 SheetJS；拒絕加密／不支援壓縮格式／macro／externalLinks／非 XLSX content type。
- 可確認的預覽以 AuditLog `IMPORT_PREVIEW` 保存伺服器計畫，綁定 email＋userId＋隨機 UUID，30 分鐘有效。此操作只保存預覽 audit，不建立 ImportBatch、主檔或庫存。前端確認僅傳 token 與勾選，不接受修改後的 quantity／plan。換檔案立即清除舊預覽與勾選。
- Confirm 使用 ReadCommitted interactive transaction：global import transaction lock → 新主檔 → itemId/locationId 遞增 advisory locks → master FOR SHARE → **新 statement 重讀庫存與驗證** → ImportBatch／所有四類資料／逐筆與批次 audit。錯誤一律 rollback。與原 IN／OUT／盤點共用 two-int pair-lock namespace。
- SHA-256 對原檔位元計算；ImportBatch unique hash＋鎖內再檢查。兩個不同 token 同時確認相同 hash 只能一個成功；改檔名不會避開防重複。結果不明時可查看匯入紀錄或安全重試。
- 不覆寫／hard delete StockMove，沒有改動其 immutable triggers。

## Migration

**沒有新增 schema 或 migration，也未修改資料庫 migration history。**

Git 切換分支曾因 `core.autocrlf=true` 將 SQL 全部變 CRLF，造成已套用 checksum 不符。依 DB 保存的 SHA-256 恢復原始換行（第一份為 LF＋最後空行 CRLF；第二份 LF），不是改寫 SQL。`.gitattributes` 對 migration 與 V2 設為 `-text`，避免 Git 再次轉換位元內容。

- initial：`b3c3c705e7c9f432a254569085e4405c4c48b4de5df4213ef005d01c17808b49`
- integrity：`5f3b9f7af87c305661de7f99dcd73d9f62998793b4270cdbfe97c86ca9cc5b6e`
- V2 原文 SHA-256 已恢復／維持：`4129374b15254ea63053279324a34aaf26d17b5b063694af875a15229822df07`。

## 測試與結果

| 命令 | 結果 |
|---|---|
| `npm test`（設定 IMPORT_SOURCE_FILE） | 241/241；未設定時 240 passed＋1 個私人來源檢查 skipped |
| `npm run db:smoke`（設定 IMPORT_SOURCE_FILE） | 33/33；含 migration exact checksum、RLS、real concurrency／rollback、來源對真實 DB 唯讀預覽 |
| `npm run test:e2e:import` | 24/24；21 moves／21 audits、6 stocktake receipt audits、3 import batches，完整回歸 |
| `npm run test:e2e:import -- --import-only` | 3/3；新增換檔清除預覽／勾選與交易方向顯示檢查；3 moves／3 audits／3 batches |
| `npm run lint` | 通過，0 warnings |
| `npm run typecheck` | 通過 |
| `npm run build` | 通過；`/import-export` 為動態、受保護頁面 |

Browser 使用 Edge Chromium、桌面／iPhone 13 viewport／Android 360px viewport，不宣稱真實 Safari 裝置驗收。已檢視手機預覽畫面，沒有水平溢出。E2E 結束停止自己的測試伺服器並移除自己的 disposable schema。

選用私人來源檢查：在 PowerShell 設定 `$env:IMPORT_SOURCE_FILE` 為本機 Excel 完整路徑，再執行上述 tests。`tests/live/import-source.test.ts` 對實際開發庫 SET TRANSACTION READ ONLY，報告寫至專案 Git 外的 `../../work/step-10-private-preview.json`；不建立預覽 token 或匯入批次。

## 實際來源預覽與尚存風險

- 已驗證 154 品項、160 期初、23 異動、20 移除歷史，阻擋錯誤 0。
- 期初 34 CONFIRMED／126 NEEDS_REVIEW；異動 6 CONFIRMED／17 NEEDS_REVIEW，合計 40 已確認／143 待確認。未知單位不猜成「個」，不同單位不猜換算比例。
- 實際 workbook 未匯入。完整逐筆預覽保存在 Git 外 `work/Step-10-匯入預覽.md`。使用者須在 App 再次預覽、核對並勾選確認，或明確確認這份具體預覽後再執行真實 commit。
- Review Queue 的人工確認與匯出仍屬 Step 11；待確認資料現階段不會計入庫存。Vercel production 與真實手機 Internet 驗收屬 Step 12–13。
- Preview audit 保留解析計畫供追溯；到期只阻止提交，不自動刪除。單人內部使用量下可接受，未來若大量上傳需另訂 audit retention。
- 2000 列／3 MB 是防護上限，不是完成時間保證；大量不同 pairs 仍可能 timeout，整批 rollback，需縮小檔案再預覽。沒有以更改 hash 規避 duplicate 的重匯覆蓋功能。

## 官方依據

- [SheetJS Node 安裝](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)：採官方 CDN 的 0.20.3 tarball，避免使用 npm registry 舊版。
- [SheetJS 讀取選項](https://docs.sheetjs.com/docs/api/parse-options/)與[公式](https://docs.sheetjs.com/docs/csf/features/formulae/)：明確啟用 cellFormula，辨識而不執行公式。
- Next 16.3.4 的 Server Actions 文件已從本機 `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` 核對，設定 bodySizeLimit 並保留 Origin 檢查。

## 下一步

完成使用者對原始資料預覽的確認後執行實際匯入。下一開發步驟為 Step 11：Review／Export；不提前進行 Vercel 部署。
