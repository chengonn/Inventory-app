# Step 12 — Vercel 部署（進行中）

2026-09-27。尚未完成正式部署或 production smoke test。

## 已完成的程式與設定

- `vercel.json`：Next.js、npm ci、production build、60 秒 function timeout。
- `.vercelignore`：排除環境檔、Excel、Git、本機產物；不將憑證隨原始碼上傳。
- `src/lib/deployment.ts`：Vercel Preview 永遠唯讀，Production 可用 INVENTORY_READ_ONLY 緊急停止寫入。
- 主檔與庫存 service 在取得 DB 前執行寫入限制；涵蓋盤點、Review、import preview audit 與 commit。workspace layout 顯示唯讀提示。
- `.env.example` 更新目前 Auth 狀態與唯讀設定。
- migration preflight 拒絕 Preview；migration 保持獨立 release step，不在 build/request 執行。
- `scripts/production-smoke.mjs`、`test:production:anonymous`：16 項未登入 HTTPS 檢查，不修改業務資料。
- `tests/unit/deployment.test.ts`：Preview／緊急唯讀阻擋所有寫入入口；Production 仍須 fresh Auth。
- `docs/VERCEL-DEPLOYMENT.md`：環境設定、migration gate、Git branch 注意事項、Auth、驗收與備份流程。

## 驗證

| 命令 | 結果 |
|---|---|
| npm test | 274 passed，1 私人 Excel 檢查 skipped |
| npm run lint | 通過 |
| npm run typecheck | 通過 |
| npm run build | 通過 |
| node --check scripts/production-smoke.mjs | 通過；不是遠端 smoke 結果 |
| git diff --check | 通過 |

尚未對正式 HTTPS 網址執行 smoke，沒有宣稱 production DB migration 完成。本步無新增 migration；V2 原文與既有 migration 不修改。

## 外部設定進度

- Vercel Dashboard 已由使用者登入。
- 官方 CLI 60.1.3 已下載至 workspace 外層 work/npm-cache；CLI 設定在 work/vercel-config，位於 App Git repository 外。
- CLI Device authorization 已由使用者完成；已建立並連結 leon-17dc/inventory-app。使用者已選擇建立獨立 Production 專案，保留 inventory-v2-dev 作開發；正式專案 inventory-v2-prod 已建立（qrfntparukzqokazvvfh，ap-northeast-2 首爾），2026-09-28 服務已啟動。正式設定已填入獨立 .env.production.local，公開 signup 已儲存為關閉、匿名登入關閉。
- GitHub 自動連結失敗：Vercel 尚未設定 GitHub Login Connection。本次可採 CLI 部署，不需改動 Git 歷史。link 自動將 VERCEL_OIDC_TOKEN 加入被 Git 忽略的 .env.local；未輸出 token，未將它設定為 App 變數。
- 沒有 commit／push，沒有匯入實際公司 Excel，沒有購買方案或更改 DNS。

## 待完成

1. 正式專案已建立；連線格式及 project ref 通過。DIRECT_URL 依 Dashboard 改為 IPv4 session pooler，並使用既有官方 CA、strict TLS。Runtime 連線回 28P01 密碼驗證失敗，待使用者修正兩條 URI 的密碼；migration 尚未成功。Vercel regions 已設 icn1。
2. 連結 Vercel project，設定 Production env、區域、Auth URL 與 signup 關閉狀態。
3. 正式 migration release/status/checksum 檢查，再部署。
4. HTTPS anonymous smoke、真實登入與業務 smoke；Step 13 實機行動網路／關機測試不得以 viewport 取代。

## 2026-09-29 更新（取代上方過時的連線待辦）

- 密碼重設同步後，Production session 與 transaction pooler 都已通過 TLS 查詢。
- 2026-09-28：正式 `db:migrate:deploy` 成功套用兩份既有 migration；`db:migrate:status` 顯示 up to date。兩份資料庫 checksum 與檔案相符，七張業務表全部啟用 RLS。沒有新增或修改 migration。
- `npm test`：274 passed、1 private-source skipped；`npm run lint`、`npm run typecheck` 通過。
- 七個 allowlisted Production 環境變數已安全上傳 Vercel；DIRECT_URL 僅留本機 migration release，不上傳 Windows CA 路徑或 VERCEL_OIDC_TOKEN。
- 使用者確認已建立正式 App 帳號。真實正式登入尚待驗收。
- 上次部署命令因自動審核用量限制未執行；2026-09-29 重新部署，目前遠端 build 進行中，尚未宣稱 Ready 或 smoke 通過。
- 遠端 build 定位到 Vercel 自動注入的公開 metadata（含 PROJECT_ID、DEPLOYMENT_ID、GIT_PREVIOUS_SHA、OBSERVABILITY_CLIENT_CONFIG）被原本僅兩個 App 變數白名單拒絕。已加入精確名稱清單，僅 VERCEL=1 時接受；未知 public 變數、資料庫 URL 與 OIDC token 仍拒絕。失敗診斷只輸出名稱，不輸出值。重新部署待驗證。

## 正式部署結果

- 2026-09-29：Vercel deployment `dpl_JB4ji6gcCQGdEPrFoDVPjLJtJZit` READY；遠端 npm ci、Prisma generate、Next production build / TypeScript 全通過。
- 固定網址：https://inventory-app-alpha-pearl.vercel.app
- 修正後 `npm test` 276 passed、1 skipped；lint/typecheck 通過。
- `npm run test:production:anonymous -- https://inventory-app-alpha-pearl.vercel.app`：16/16 通過。
- Read-only 查詢正式 auth.users：總數 0，allowed email 不存在；使用者先前回覆已建立，但需在正確正式專案重新確認。真實登入與業務 smoke 尚未完成，因此 Step 12 尚未結案。
- 修改檔案：scripts/public-env-policy.mjs、scripts/check-public-env.mjs、tests/unit/public-env-policy.test.ts、docs/STEP-12.md。沒有新增 migration 或匯入實際 Excel。
- 正式 Supabase Site URL 已設 https://inventory-app-alpha-pearl.vercel.app；無 wildcard redirect。Email/password 登入不需 OAuth callback。
- 正式帳號後續驗證：allowed email 在正式 auth.users 中恰有 1 筆，email_confirmed_at 已設定。已開啟正式 App 登入頁，等待使用者輸入自行設定的 App 密碼，以繼續 authenticated smoke；不索取或保存密碼。

## 2026-09-29 正式登入與業務 smoke

- 真實 allowed-email 登入成功；重新整理後 session 保留；已登入開 /login 轉 dashboard。登出成功，登出後 /inventory 轉 /login。
- 正式 UI 建立明確標記的「正式驗收-20260929」品項與「驗收測試 / SMOKE-20260929」櫃位。
- 入庫 10 成功；出庫 11 預覽被庫存不足拒絕；出庫 3 成功。盤點 6 產生盤損 -1，該盤損沖銷新增 +1，最後盤點 0 產生 -7。
- READ ONLY DB 核對：5 筆 CONFIRMED StockMove，sum(signedQty)=0.000，1 筆 reversal。4 CREATE + 1 REVERSE 的 StockMove audits、2 Stocktake receipts 皆存在。normalizedQty 是絕對數量，不能直接加總為淨庫存。
- 驗收品項與櫃位已停用，安全庫存清空；保留所有歷史及 audit，沒有 hard delete。櫃號搜尋回傳正確品項及 0.000 庫存。
- 匯出 UI 發出請求後沒有錯誤，但內建瀏覽器 download event 超時、未取得 Excel 檔。只能確認 UI 未報錯，不能宣稱檔案內容通過；須在一般瀏覽器下載後核對。
- 本輪只更新文件，無程式或 migration 變更；此前 tests 276 passed + 1 skipped、lint/typecheck/remote build、anonymous HTTPS 16/16 結果仍有效。
- Step 12 仍待匯出實檔核對及正式環境非 allowed-email / Preview 拒寫的遠端驗收（本機保護測試已通過）；Step 13 手機行動網路與 Windows 關機實機驗收尚未進行。實際公司 Excel 仍未匯入。

## 權限隔離遠端驗收準備

- 使用者已確認以一般瀏覽器下載的正式 Excel 能正常開啟；下載／可開啟驗收通過，未宣稱每個儲存格內容皆經機器核對。
- 已檢查登入實作：Supabase signInWithPassword 成功後仍以 fresh getUser + allowed-email policy 驗證，不符時 local signOut 並回「此帳號無權使用本系統」。需要實際第二個 confirmed Auth 帳號，不能以密碼錯誤當作通過。
- Preview guard 在 business actor 取得 Auth/DB 前拒絕寫入。本機測試涵蓋主檔、IN/OUT、reversal、stocktake、import preview/confirm、review。遠端驗收將使用獨立 dev，不能使用正式憑證。
- 開發庫唯讀基準：Item=0、StockMove=0、AuditLog=0；正式庫 Item=1、StockMove=5、AuditLog=12。
- 開發環境變數上傳 Preview 被自動審核拒絕（缺少敏感憑證傳送目的地的明確授權），操作未執行，已請使用者確認。等待第二個正式測試帳號及 Preview 上傳授權後繼續；本輪沒有 migration 或業務資料變更。

## 2026-09-30 權限驗收續作

- 使用者明確授權將開發連線與 App 設定上傳 Vercel Preview，六項 dev 設定上傳成功；未上傳正式憑證、DIRECT_URL 或 OIDC token。
- Preview deployment Arnnwa6axMA41TZqmb4rccoAUVHe 建置中，尚未宣稱禁止寫入遠端驗收通過。
- 指定的第二個正式測試帳號已由 READ ONLY 查詢確認存在且 Email confirmed；正式登入頁已準備，等待使用者輸入自己的測試密碼。
- Preview dpl_Arnnwa6axMA41TZqmb4rccoAUVHe 已 READY：https://inventory-crpfroaee-leon-17dc.vercel.app 。遠端 build/typecheck 通過，登入頁可存取。正式 deployment 未替換。等待使用者登入後測試實際 Server Actions 拒寫。
- 部署 npm ci 出現新 dependency advisory（遠端顯示 moderate/high）；本機 npm audit --omit=dev 顯示 6 moderate、0 high，集中 Prisma 開發工具相依鏈且無自動修復。兩端結果不同，尚待完整 advisory 核對，未執行盲目 npm audit fix 或升版。
- 正式非 allowed-email 驗收通過：使用者以 confirmed 測試帳號登入後，agent 在正式 UI 親自觀察「此帳號無權使用本系統」。隨後直接開 /inventory 仍轉 /login，沒有授予業務存取。Preview authenticated 拒寫仍待開發帳號登入。

## 2026-09-30 Preview 禁寫驗收結果

- 已以真實開發 Supabase 授權帳號登入 Preview，頁面顯示唯讀提示。
- 提交格式有效的新增品項表單，server action 回「此環境僅供查詢，已停用庫存與主檔寫入」，未新增品項。
- 使用 tests/fixtures/import-workbook.ts 產生無公司資料的測試 Excel，透過 UI 上傳並按預覽，server action 同樣拒絕；沒有建立 ImportPreview audit 或批次。
- 此兩條 remote paths 分別覆蓋 master-data actor 與 moves actor 的獨立寫入 guard。其餘 IN/OUT/reversal/stocktake/review/import confirm 共用 guard 的涵蓋由本機 deployment tests 驗證，未聲稱逐一在遠端重播所有 mutation。
- 唯讀 SQL 核對開發庫七張表（Item/Location/OpeningInventory/StockMove/ArchivedRecord/ImportBatch/AuditLog）均為 0；沒有業務資料或 audit 被寫入。
- 正式 non-allowed-email 已拒絕，Preview 兩個 guard 真實拒寫通過；使用者已確認正式匯出 Excel 能開啟。Step 12 功能驗收完成，後續為 Step 13 實機驗收。另有 dependency advisory 差異需另行核對，沒有宣稱 dependency audit clean。
- 本輪只更新 docs/STEP-12.md、AGENTS.md 與忽略的合成測試檔；無 migration、無正式程式重部署、無公司 Excel 匯入。

## 2026-10-04 實際匯入核對

使用者回報已透過 App 匯入成功；agent 僅執行正式庫 READ ONLY 查詢，沒有再次匯入。批次 1 於 2026-10-04 21:23:48（台北）完成：154 品項、160 期初、32 異動、20 移除歷史；期初 CONFIRMED 34 / NEEDS_REVIEW 126，異動 CONFIRMED 9 / NEEDS_REVIEW 23，待確認共 149。存在 1 個 IMPORT audit 與 1 個 IMPORT_PREVIEW audit。此結果不同於早期唯讀預覽的 23 異動／143 待確認，以本次正式批次為準；未對來源檔版本或每列內容作一致性宣稱。待確認不計入 normalized stock，需逐筆核對後確認，不能整批盲目確認。
