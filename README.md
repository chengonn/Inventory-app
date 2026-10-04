# 庫存管理 Web App V2

> 2026-09-08 更新：Supabase 開發專案已建立，兩份 migration 已套用，runtime pooled connection 與完整 4 項雲端 smoke test 已通過。最新狀態見 [真實連線報告](docs/STEP-03-LIVE.md)。以下未設定專案的敘述為先前離線階段紀錄。

本專案唯一規格來源為 [docs/V2.md](docs/V2.md)，原文複製自下載資料夾的「庫存管理系統_Codex實作規格_雲端版V2.md」。V1 的 SQLite、Windows/LAN Server 與 PIN 登入規格全部失效。

## 目前進度

Step 12 正在準備 Vercel 部署；部署設定、Preview 寫入保護及匿名 smoke script 已完成，274 項本機測試、lint、typecheck、build 通過。正式資料庫選擇與部署仍待完成，見 [Step 12 進度](docs/STEP-12.md) 及 [部署流程](docs/VERCEL-DEPLOYMENT.md)。目前沒有 production smoke 成功紀錄。


Step 11 Review／Export 已完成：待確認資料的預覽確認／忽略、鎖後重算庫存與原子 audit、防重送、庫存與篩選異動匯出、完整 Excel 備份。271 項本機測試（另 1 skipped）、36 項真實 DB 測試（另 2 skipped）、27 項 E2E、lint、typecheck、production build 通過；見 [Step 11 報告](docs/STEP-11.md)。下一步為 Step 12 Vercel 環境與部署，目前尚未上線。


Step 10 Excel 匯入已完成：四張工作表的 server-side 解析／驗證、逐筆 Preview、勾選 Confirm、SHA-256 防重複、鎖後庫存檢查與整批 transaction／audit。241 項本機測試（含選用原始檔）、33 項真實 DB 檢查、24 項完整 E2E＋3 項補充匯入 E2E、lint、typecheck、build 通過；見 [Step 10 報告](docs/STEP-10.md)。原始 Excel 僅完成唯讀預覽，尚未匯入；40 筆可確認、143 筆需人工核對換算或單位。使用者在 `/import-export` 預覽並確認後才 commit。Step 11 已接續實作，驗證紀錄見 [Step 11 報告](docs/STEP-11.md)。

Step 9 Dashboard／Query 已完成：六項即時查詢統計、最近 10 筆異動、品項／區域／櫃號搜尋、低庫存與分頁。沿用已確認流水計算，低庫存以全櫃位總量比較，今日採台北時間；讀取使用一致的唯讀 snapshot。218 項本機測試、24 項真實 DB 測試、21 項 E2E、lint、typecheck、build 通過；見 [Step 9 報告](docs/STEP-09.md)。`npm run test:e2e:query` 重跑包含既有交易的完整回歸。Step 10 已接續完成（見上方）。

Step 8 盤點已完成：選櫃位、實際數量預覽確認、依序鎖定後重算盤盈／盤損、整批 atomic audit、零差額不建立交易但保留防重送收據。203 項本機測試、22 項真實 DB 測試、18 項 E2E、lint、typecheck、build 通過；見 [Step 8 報告](docs/STEP-08.md)。執行 `npm run test:e2e:stocktake` 可重跑隔離資料庫的完整瀏覽器驗證。2026-09-17 已恢復先前被暫停的 Supabase 開發專案並重驗連線。Step 9 已接續完成（見上方）。

Step 7 IN／OUT／reversal 已完成：預覽與確認、品項＋櫃位 transaction advisory lock、鎖後重讀庫存、原子 audit、防重送與沖銷保留歷史。當時 189 項本機測試、14 項真實 DB 測試、15 項 E2E、lint、typecheck、build 通過；見 [Step 7 報告](docs/STEP-07.md)。`npm run test:e2e:moves` 會使用開發資料庫的暫存 schema 驗證真實寫入並自行清除，目前也包含 Step 8 回歸。

Step 6 庫存計算服務已完成，163 項測試、6 項真實 DB smoke、lint、typecheck、build 通過。只加總 CONFIRMED 期初與異動，尚未接入庫存查詢 UI；见 [Step 6 報告](docs/STEP-06.md)。

Step 5 主檔管理已完成：/items 與 /locations 可新增、查詢、編輯、停用／重新啟用。140 項測試、5 項 DB smoke、12 項 E2E 通過；見 [Step 5 報告](docs/STEP-05.md)。db:smoke 含最終 rollback 的主檔寫入測試，僅用開發專案。

Step 4 登入、登出與 server-side allowed-email guard 已加入；119 項測試、lint、typecheck、build 通過。真實登入／登出、隔離 Auth E2E 9/9 與匿名保護 3/3 均已驗收，見 [Step 4 報告](docs/STEP-04.md)。

Step 1 已完成版面。Step 2 已加入 Supabase browser/server utilities、session refresh Proxy 與 cookie/cache 處理，完成本機測試。Supabase 開發專案與 Step 3 migration 已完成真實驗證；完整登入與 allowed-email guard 屬 Step 4。尚未完成全部業務流程與雲端部署，不可當成已上線系統。

固定後續架構：Vercel + Supabase PostgreSQL + Supabase Auth + Prisma。業務資料只能由 server-side 存取，不允許公開註冊。Auth 完成前不可部署庫存資料。

## 本機執行

使用 Node.js 24.x LTS（本機驗證版本 24.18.0）及 npm。於本目錄執行：

```powershell
npm install
npm run dev
```

瀏覽 http://localhost:3000 。尚未設定 Supabase 時，會顯示「Supabase 設定未完成」並回 HTTP 503；這是預期的設定缺漏狀態，不是已登入或已連線。詳細設定見 [Supabase 設定與 utilities 用法](docs/SUPABASE-SETUP.md)。本機開發服務不是最終雲端部署。

如果此 Windows 的 npm 指向失效的 Roaming 路徑，先在目前 PowerShell 修正 PATH；若公司網路使用系統信任憑證，可使用系統 CA，請勿停用 TLS 憑證驗證：

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
$env:NODE_OPTIONS = '--use-system-ca'
& 'C:\Program Files\nodejs\npm.cmd' --version
```

若仍被失效的 PowerShell npm.ps1 攔截，可直接使用 `& 'C:\Program Files\nodejs\npm.cmd' run dev` 等完整命令，不需更動全域 npm。

## 驗證

```powershell
npm run lint
npm run typecheck
npm test
npm run build
# 已設定有效專案，另一個終端先執行 npm run start，再執行：
npm run test:e2e
```

沒有 Supabase 專案仍可執行 `npm test`（含實際 SDK + 攔截 HTTP 的離線 refresh 測試）。未設定狀態的 E2E：先執行 build 並另開終端啟動 start，再設定 `$env:E2E_UNCONFIGURED='1'` 後執行 `npm run test:e2e`。完整的離線版面 E2E 指令見 [Step 2 報告](docs/STEP-02.md)。

E2E 使用已安裝的 Microsoft Edge，包含桌面、iPhone 尺寸與 Android 尺寸的 Chromium viewport。測試對象預設為 localhost:3000；需先以另一個終端啟動 npm run start。可設定 E2E_BASE_URL 指向已啟動的本機服務（Step 2 使用 http://127.0.0.1:3032 的 production build）。使用分開啟動的服務，避免 Windows 環境中 Playwright 自動停止 webServer 時無法結束。這不是實體 iPhone Safari 驗證，也不是正式版手機業務驗收。

## 環境與後續步驟

`.env.example` 僅列變數名稱，沒有密鑰。建立 Supabase 開發專案後複製為 `.env.local`，填入 HTTPS URL 與 `sb_publishable_` key。環境變數格式錯誤時，predev/prebuild 會中止，且不輸出設定值。本專案僅准許這兩個 public 變數。`ALLOWED_USER_EMAIL` 僅供 server 使用。禁止將 database credentials 或 service-role key 加上 `NEXT_PUBLIC_` 前綴。

Step 3 已安裝 Prisma 7.10.0，建立 PostgreSQL schema、兩份 migration 與分離的 runtime/migration 連線設定，完成離線驗證。兩份 migration 已套用 Supabase 開發專案，完整雲端 smoke test 4/4 通過。請閱讀 [資料庫設定](docs/DATABASE-SETUP.md) 與 [Step 3 報告](docs/STEP-03.md)。

Step 4 完成登入、登出與 server-side 白名單驗證；初始帳號由管理者建立，關閉公開 signup。

Step 5–11 依 docs/V2.md 逐步完成主檔、庫存計算、交易、盤點、查詢、Excel Preview → Confirm、Review 與備份匯出。每一步 tests/lint/typecheck 通過才繼續。

Step 12–13 才設定 Vercel Preview/Production、production migration 與 HTTPS deployment，執行 production smoke test。Preview 必須使用獨立測試資料庫或關閉 mutation；不自動在每次 request 跑 migration。

後續 README 將於對應步驟補齊已驗證的帳號建立、密碼重設、Prisma migration、首次匯入、Vercel env 與部署、手機 HTTPS 使用、備份復原流程。Supabase backup/PITR 能力需依實際方案核對：https://supabase.com/docs/guides/platform/backups 。

## Excel 來源

已找到 `C:\Users\cheng\Downloads\庫存整理版_無巨集主檔版_品項下拉已修正.xlsx`。

SHA-256：`8335A92AA52FA6447B6EE7F9328268A853F5655F0FC192206C9FDFF554ECB7B3`。

已完成唯讀解析與預覽：154 品項、160 期初、23 異動、20 移除歷史；40 筆可確認、143 筆待人工核對。原始 Excel 尚未匯入，也不放入 Git 或 public 資料夾。請於 App 上傳、核對 Preview 並勾選 Confirm 後提交。

## 官方依據

- Next.js 安裝與 App Router：https://nextjs.org/docs/app/getting-started/installation
- Next.js CSS：https://nextjs.org/docs/app/getting-started/css
- Tailwind + Next.js：https://tailwindcss.com/docs/installation/framework-guides/nextjs





## Review 與 Excel 備份

在待確認頁逐筆補齊數量／單位並預覽後確認，或填寫原因忽略；原文與歷史保留。庫存與異動頁可匯出當前篩選的全部頁面；Excel 匯入／匯出頁可下載完整業務備份。數量以文字保存精度；備份不是四表匯入模板，也沒有自動還原入口。長 audit JSON 的重組、檔案上限及資料庫備份注意事項見 [Step 11 報告](docs/STEP-11.md)。
