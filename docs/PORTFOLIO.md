# 手動庫存展示版（2026-10-08 需求變更）

使用者決定將作品提供面試官實際操作，以手動建檔取代 Excel 匯入，並接受獨立展示環境：相同 Email、不同密碼，僅虛構資料。這項最新需求取代 V2 的匯入優先使用流程；`docs/V2.md` 原文與已套用 migration 不修改。既有正式庫存與其歷史保留。

## 使用流程

1. 使用作者私下提供的展示帳號登入，沒有公開註冊。
2. 「新增品項與庫存」輸入名稱、初始數量、單位、區域、位置與選填備註。
3. 初始數量大於零產生 CONFIRMED IN；零數量建立 CONFIRMED zero opening，記錄已知零庫存與位置，不產生零數量異動。
4. 已存在名稱不會被覆蓋，也不會把填寫值當成補貨；補貨改用入庫，領用改用出庫，實際數量核對改用盤點。
5. 主檔、入庫/零期初與 audits 同一 ReadCommitted transaction；重送使用 UUID 與 actor/payload fingerprint 收據防重複。失敗保留表單內容。單位建立後不可直接改變，避免重解讀歷史數量。
6. Excel 匯入預設關閉，伺服器 preview/confirm 同樣拒絕；匯出保留。歷史程式只有明確 server env `ENABLE_LEGACY_EXCEL_IMPORT=true` 才啟用。

## CIA 已實作保護

| 維度 | 保護與限制 |
|---|---|
| C | 保留每次 server-side Auth 身分驗證與 allowed email、server-only DB utilities、無 token/error stack 回傳。新增防嵌入、nosniff、no-referrer 等 headers。展示旗標只顯示提示，實際隔離必須靠獨立 Supabase/Vercel 專案。 |
| I | 手動新增的伺服器欄位長度/十進位驗證、atomic masters/stock/audit、重送收據、沿用 pair advisory locks。原本 concurrent OUT、reversal、盤點協定不變。Next.js 原生 Server Action Origin 檢查不放寬。禁止更改既有品項單位。 |
| A | DB 原子固定分鐘限流：login 10、write 60、export 5；只保留三個固定 scope，不儲存 IP/Email/Token。跨 serverless instance 共用，故障 fail closed。限流交易 4 秒、lock 1 秒、statement 2 秒；手動交易 15 秒、lock 3 秒、statement 10 秒；主檔交易明訂 15 秒。匯入關閉時 Action body 降至 64 KB。新增安全錯誤頁。 |

限流採 PostgreSQL `INSERT ... ON CONFLICT DO UPDATE`，超額 counter 飽和，不無限增長；超額判定在 commit 後拋出，避免 rollback 掉计數。單帳號共用 quota 是刻意設計，並非多租戶系統。

## 展示版部署門檻

- 使用者已同意恢復 inventory-v2-dev 作為獨立展示庫，並已恢復。不要把目前 `.env.production.local` 上傳為展示環境設定。
- 新建獨立 Vercel 專案，以其 Production deployment 供互動展示。現有 Vercel Preview 永遠唯讀，不能為了展示移除 guard。
- 使用相同 Email 建立展示 Supabase Auth 使用者，密碼與正式環境不同。關閉 signup/anonymous，Data API 不開放 inventory schema。密碼不進 Git、README 或本對話。
- 設定展示专案的 publishable URL/key、transaction pooler DATABASE_URL、server-only ALLOWED_USER_EMAIL、TLS CA，`INVENTORY_DEMO=true`、`ENABLE_LEGACY_EXCEL_IMPORT=false`。DIRECT_URL 僅 migration 使用，不上傳 runtime。
- **先執行全部三個 migrations 再部署新程式**。第三個 `202610080001_rate_limit` 新增 RateLimitBucket/RLS/角色權限，沒有修改業務資料。未套用時登入/寫入/匯出會安全拒絕。
- 以展示/開發 DB 跑 `node --use-system-ca node_modules/vitest/vitest.mjs run --config vitest.live.config.ts tests/live/moves.test.ts -t "manual|rate limit"`，使用 disposable schema 驗證真實並發與回滾。
- `npm run test:e2e:manual` 使用 disposable schema 與隔離 Auth transport，驗證桌機及兩種手機尺寸；真實展示帳號登入、手機與遠端限流仍需部署後 smoke test。
- 不複製公司資料，不自動匯入原 Excel，不清除正式或歷史交易。

## 尚存風險

- 共用展示帳號無法區分操作者；給面試官的密碼不應與個人/正式密碼重複，展示結束更換密碼並撤銷舊 session。
- 全站 login quota 可能被故意耗盡；應搭配 Vercel WAF/CAPTCHA 與 Supabase Auth 平台限流。資料庫 limiter 不是 DDoS 防護，不能保護所有頁面流量或直接呼叫 Supabase Auth。
- 查詢仍在記憶體聚合；展示需限制資料規模，後續才考慮 SQL 分頁/匯出背景工作。不要把此單帳號設計當成多租戶 SaaS。
- runtime 現有 DB 角色權限仍較高；least-privilege 專用角色與災難還原演練需要另行驗證，RLS 不限制 table-owner runtime。
- 新增 RateLimitBucket 是可重建的操作控制狀態，不列入業務 Excel 備份；收據 AuditLog 必須保留。
- 依賴已更新 Next.js/@next/env/eslint-config-next 至 16.3.8，以及 sharp、fast-uri、source-map-js、brace-expansion 相容修補版。2026-10-08 `npm audit --omit=dev`：0；完整 audit 仍有 5 個 high，來自開發工具 eslint-config-next → fast-glob → micromatch → braces。沒有為了消除報告而強制降級 Next.js；本次不宣稱完整 audit clean。

## 驗證記錄

- 本機 `npm test`：299 passed、1 private-source skipped（原 Excel 不需要提供）。包含 PostgreSQL WASM 的限流 migration/SQL/權限測試，不等同 Supabase migration 已執行。
- 2026-10-11 恢復 inventory-v2-dev 後，`npm run db:migrate:deploy` 成功套用 `202610080001_rate_limit`；三份 migrations checksum 與八張表 RLS 驗證通過。原公司正式 DB 未套用本次變更。
- 真實 DB 測試：40 passed、2 private-source skipped；手動新增及限流 focused live tests 4 passed。`npm run test:e2e:manual` 三個 viewport 全數通過並清理 disposable schema。舊流程完整 E2E 的最終測試 artifact 顯示 passed；未保留其最終 stdout，故不以此宣稱額外的 DB 計數驗證。
- `npm run lint`、`npm run typecheck`、production build 通過。2026-10-11 runtime audit 0；完整 audit 仍有上述 5 high 開發依賴問題。
- `docs/V2.md` 與兩個舊 migrations SHA-256 均與既有紀錄一致；Git 追蹤的環境檔只有 `.env.example`，沒有原 Excel。
- 獨立展示站已部署：https://inventory-portfolio-lac.vercel.app ，deployment `dpl_HThcXWXV7cDTggJP7AUt8F8F1cfL` READY，remote build 通過。`node --use-system-ca scripts/production-smoke.mjs https://inventory-portfolio-lac.vercel.app`：16/16 通過；另外確認手動建檔頁未登入會跳轉及安全 headers。展示 Auth signup 與 anonymous 均關閉。
- 使用者已確認透過本機 `scripts/set-demo-app-password.ps1` 設定新展示密碼；此工具限定展示 project/user、不保存金鑰密碼，且排除於 Vercel upload。真實展示帳號登入與遠端手動庫存操作驗收仍待完成，匿名 smoke 不等同完整功能驗收。
- 現有公司正式部署與業務資料沒有更動。`.vercel/project.json` 仍指向原專案，展示部署務必明確指定 `--project prj_f6cLtMTAy1XibgKGksOCOJEnJE8X`，避免誤部署。

## 官方依據

- [PostgreSQL atomic ON CONFLICT](https://www.postgresql.org/docs/16/sql-insert.html)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Next.js ImageResponse security advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)
- Next.js Server Actions 指引以實際安裝版本 `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` 為準。

## 2026-10-11 展示站真實登入後驗收

- 使用者確認已設定獨立展示密碼並登入；代理在新的受保護頁確認 session 有效，重新整理仍保留登入。
- 真實 HTTPS UI：手動建立虛構品項「展示驗收・筆記本 20261011」，初始 10 本；入庫 5 → 15；超量出庫 16 被拒絕；出庫 3 → 12；盤點實際 11 → 盤損 1。重新整理庫存頁顯示 11 本。
- 展示 DB READ ONLY 核對：四筆 CONFIRMED StockMoves，signedQty 分別 10、5、-3、-1；四筆 StockMove audits、一筆 ManualReceipt、一筆 Stocktake receipt，以及 Item/Location audits 各一筆。虛構展示資料保留供體驗，沒有 hard delete。
- 本輪修改僅驗收文件，無新增 migration 或 runtime 程式碼；沿用前次本機 tests/lint/typecheck/build 通過結果，沒有聲稱本輪重跑。截圖保存在 ignored test-results/portfolio-live-stock.jpg。
- 本次未重做展示站實體手機／電腦關機、登出後重新登入、遠端並發與所有拒絕路徑。並發與重送由先前 live disposable-schema tests 覆蓋；不把本次 smoke 當成完整滲透測試。
