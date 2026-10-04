# Step 2 — Supabase project integration

日期：2026-09-05。狀態：**程式與本機驗證完成；使用者尚未建立 Supabase project，未驗證真實雲端 Auth。** 依本次指示未開始 Step 3。V2 原文 hash 比對一致。

## 修改檔案

新增：

- src/lib/supabase/config.ts：公開環境變數驗證與 cookie policy。
- src/lib/supabase/client.ts：browser Auth client factory。
- src/lib/supabase/server.ts：request-local RSC / Server Action factories。
- src/lib/supabase/route-handler.ts：Route Handler cookie/header adapter。
- src/lib/supabase/response.ts：統一禁止 session response 快取。
- src/lib/supabase/proxy.ts、src/proxy.ts：session refresh 與 request/response cookie 同步。
- scripts/check-public-env.mjs、scripts/public-env-policy.mjs：編譯前攔截誤標為 public 的秘密設定。
- tests/setup.ts：Vitest 的 server-only mock；不影響 Next production boundary。
- tests/unit/supabase-config.test.ts、supabase-adapters.test.ts、public-env-policy.test.ts。
- tests/integration/supabase-refresh.test.ts、public-env-check.test.ts。
- tests/e2e/setup.spec.ts：未設定狀態 HTTP 503 / no-store 驗證。
- docs/SUPABASE-SETUP.md、docs/STEP-02.md。

修改：

- package.json、package-lock.json：鎖定 @supabase/ssr 0.12.6、@supabase/supabase-js 2.115.0、@next/env 16.3.4、server-only 0.0.1；加入 predev/prebuild。
- src/app/(workspace)/layout.tsx：force-dynamic，禁止工作區 ISR。
- vitest.config.ts：加入 integration 測試、server-only setup 與路徑 alias。
- playwright.config.ts、tests/e2e/scaffold.spec.ts：分開測試未設定與已提供 public 設定的狀態，驗證 no-store。
- .env.example、README.md、AGENTS.md：更新目前進度、設定方式與 Step 4 邊界。
- docs/screenshots/desktop.png、mobile.png、android.png：E2E 重新產生截圖，版面未改。

## 完成功能

- browser/server 使用官方 SSR 套件，不採用舊 Auth Helpers。
- 以 getAll/setAll 支援 cookie 分段、refresh、刪除與多次 callback；request 更新供 RSC 使用，response 更新供 browser 保存。
- 採用 setAll 第二參數的 cache headers，並確保後續 cookie 寫入不遺失第一批 headers。
- server-side 專用模組以 server-only 阻止 client import；每個 request 建立 client，不全域共享 session。
- RSC 只讀、Server Action 可寫入且不吞錯誤、Route Handler 保留原 response cookie/headers。
- Proxy 呼叫 getClaims 進行 refresh/驗證，未使用 getSession 作為身份授權。
- cookie 使用 host-only、Path=/、SameSite=Lax、production Secure。因 browser SDK 需要讀取 token，採用官方 SSR 模式的 HttpOnly=false，詳細理由見設定文件。
- missing config / Auth 暫時不可用回不含敏感細節的 503；所有 matched pages/API 回 private/no-store。
- predev/prebuild 在 Next 開始編譯前檢查 public 設定，錯誤訊息不列出設定值。

未建立 signup UI、login/logout、allowed-email guard、業務 API 或資料庫。Proxy 的 refresh 不等於 authorization；有效設定下匿名使用者仍可見沒有真實資料的 scaffold。

## Migration 變更

無。未安裝 Prisma、未建立 schema/migration、未連線或改動任何 Supabase database。DATABASE_URL / DIRECT_URL 仍待 Step 3 依實際安裝版本官方做法設定。

## 測試命令與結果

本機 Node.js 24.18.0；由於此機預設 npm wrapper 路徑失效，實際使用 `& 'C:\Program Files\nodejs\npm.cmd'` 執行下列 npm 命令。套件安裝採用系統 CA，未關閉 TLS 驗證。

| 命令／檢查 | 最終結果 |
|---|---|
| npm install --save-exact @supabase/ssr @supabase/supabase-js server-only | 成功 |
| npm install --save-exact @next/env@16.3.4 | 成功；npm audit 0 vulnerabilities |
| npm test | **47/47 通過，6 files，exit 0** |
| npm run lint | 通過，零 warning，exit 0 |
| npm run typecheck | 通過，exit 0 |
| npm run build（離線測試 public 設定） | 通過，含 Proxy，工作區 dynamic |
| npm run test:e2e（離線設定 + production build） | **6/6 通過，13.9 秒，exit 0** |
| npm run build（未設定 Supabase，最終保留狀態） | 通過；prebuild 明示 request 回 503 |
| E2E_UNCONFIGURED=1 + npm run test:e2e | **3/3 通過，5.4 秒，exit 0** |
| browser .next/static/*.js 掃描 | 未見 database/service-role/allowed-email identifiers 或 test secret 字串 |
| docs/V2.md 與下載來源 hash 比對 | 一致 |
| 測試伺服器結束檢查 | 自行啟動的 3032 已停止，HTTP 不再回應 |

實際 SDK 測試只攔截 HTTP transport，驗證過期 session refresh、SDK 編碼與分段 cookie、new refresh token、舊 cookie 移除、無 session 不發 HTTP、invalid refresh token 清除。這些 fixture 只存在測試檔案／測試程序，不是 Supabase 雲端驗證，也不是庫存 mock data。

初次 tests/typecheck 發現 Next.js 附帶文件所稱 unstable_doesProxyMatch 未實際 export；依已安裝 runtime/types 改用 unstable_doesMiddlewareMatch 後，完整重跑通過。沒有忽略失敗。

### 重現沒有雲端專案的版面 E2E

以下使用保留的 `.invalid` domain 與明確的測試 public key，**僅限本機匿名 scaffold 測試，不能登入、不能部署**。不寫入 .env.local。先確認沒有在此專案執行其他 build；測試 port 若被使用，改成另一個空 port。

終端 A：

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='https://inventory-test.invalid'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_local_test_only'
npm run build
npm run start -- --hostname 127.0.0.1 --port 3032
```

終端 B：

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:3032'
$env:E2E_UNCONFIGURED='0'
npm run test:e2e
```

終端 A 以 Ctrl+C 停止該伺服器，移除剛設定的測試變數並重新 build，避免留下 fixture 設定的 build：

```powershell
Remove-Item Env:NEXT_PUBLIC_SUPABASE_URL
Remove-Item Env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run build
npm run start -- --hostname 127.0.0.1 --port 3032
```

終端 B 驗證未設定狀態（目前沒有 .env.local，亦沒有其他真實設定）：

```powershell
$env:E2E_UNCONFIGURED='1'
npm run test:e2e
```

驗證後再以 Ctrl+C 停止終端 A 的測試服務。本次已完成上述清理，未占用使用者的 3000 開發服務。

## 尚存風險

- 尚無 Supabase project：未測真實 URL/key、真實登入/登出、session refresh、後台 signup 開關或網路失敗恢復。
- 缺少 env 現在會回 503，這是預期行為；先照 SUPABASE-SETUP.md 建立開發專案並填入兩個 public 值。
- 完整登入與 allowed-email guard 屬 Step 4，目前不得把真實庫存接到 scaffold 或公開部署。
- cookie 採 browser/server 共享模式，HttpOnly=false；後續需維持輸入驗證與 XSS 防護，不把不可信 HTML 注入頁面。
- Proxy getClaims 並非即時後台撤銷狀態查詢，Step 4 的敏感操作驗證需考慮 getUser。
- 本機 E2E 是 Chromium 桌面與手機 viewport，不是實體手機/Safari 或 Vercel production smoke test。
- predev/prebuild 只有使用 package scripts 才會執行；部署須使用 npm run build，不應繞過該檢查直接啟動 Next build。
- 既有 ESLint 9 停止支援提示與 unrs-resolver optional script 提示仍如 Step 1 記錄；目前 lint/build 通過。
- 目前專案目錄不是 Git repository；.gitignore 已備妥，尚未建立 remote 或部署紀錄。

## 下一步

Step 3：安裝 Prisma，依實際版本 Supabase/Prisma 官方文件建立 PostgreSQL schema、runtime transaction pooler 與 migration direct/session connection 設定。若仍無 Supabase project，可準備程式，但不可聲稱 migration 已執行成功。

完整登入、登出、protected route、ALLOWED_USER_EMAIL guard 留待 Step 4。
