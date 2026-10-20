# 訪客 Demo 與 CIA 審查（2026-10-19）

2026-10-20 更新：依使用者要求，在展示登入頁公開 **App 分享帳密**，並提供中英文切換。新版本已完成真實訪客英文操作與權限驗收，詳見 [登入與語言變更](LANGUAGE-AND-GUEST-LOGIN.md)。公開 App 密碼仍與 Supabase backend 密碼分離；本頁歷史部署資訊保留供追溯。

## 範圍與目前狀態

使用者選擇：訪客可建檔、入庫、出庫及盤點，不能完整備份或管理。所有訪客共用獨立展示資料庫，並非每人隔離 workspace；只能輸入虛構資料。本次進一步禁止訪客所有檔案匯出、Review、Excel 匯入與沖銷，減少 audit 與管理資料曝光。管理者功能保留。

程式、本機驗證與訪客遠端驗收已完成（2026-10-20）。訪客帳號已建立，設定上傳至獨立展示專案，deployment `dpl_5AbhQx3EBySAxrSU1aZ7qDivX9Wu` READY，網址 https://inventory-portfolio-lac.vercel.app 。公司正式專案未變更。無新增 migration，沿用三份已套用的 migrations。

## 發現與修正

| 維度 | 問題 | 修正 |
|---|---|---|
| C/I | 原先只有單一白名單身分，登入者都可使用管理與完整備份 | 新增伺服器產生的 guest role；主檔 service、Review、Import、reversal 與 export API 獨立拒絕；導覽同步隱藏 |
| I/A | 直接分享 Supabase 密碼與瀏覽器 access token，可能讓訪客透過 Auth API 改密碼、影響共用帳號 | 分享 App 密碼與隨機 Supabase backend 密碼分開。分享密碼只存 scrypt salted hash；伺服器登入 Supabase，access token 以 AES-256-GCM 封裝為短效 HttpOnly cookie，不把原始 token、refresh token 或 backend 密碼交給訪客 |
| C/I | 錯用正式環境或以 user metadata 偽造權限 | guest 需完整 env、指定 demo URL 與 runtime DB project；每次使用 Supabase getUser 檢查固定 UID、Email、confirmed、非 anonymous；不讀 user metadata 決定管理權限 |
| A | 每分鐘限流仍不能阻止長期灌入資料 | 訪客寫入共用交易鎖；建檔上限 200 品項，訪客 audit 達 2000 後停止新寫入。最後一筆多行盤點可略超 2000，最多本筆 50 個異動加 1 收據；既有請求重送仍回傳原收據 |

## 已檢查的既有保護

- Git 追蹤的環境檔只有 `.env.example`，沒有 Excel；新私有 `.env.guest*.local` 同樣被 Git 與 Vercel upload 忽略。
- 原始碼搜尋未見 `dangerouslySetInnerHTML`、`$queryRawUnsafe` 或 `$executeRawUnsafe`。輸入以 React 文字呈現，SQL 使用參數化模板；這是程式審查結果，不等於完整滲透測試。
- DB pool log 為固定通用訊息；登入、匯出與業務錯誤不回傳 credentials/stack。訪客無法下載完整 audit 備份。
- Server Actions 保留框架 Origin 檢查，未放寬 allowedOrigins；guest cookie 使用 SameSite=Strict、Production Secure、HttpOnly、無 Domain、最多 20 分鐘。
- 保留 ReadCommitted、交易層級 advisory lock、鎖後重讀及 atomic audit。ManualReceipt、Stocktake 收據不得清除。
- Preview 寫入保護不變。沒有使用 SQLite、公開 signup、client DB credentials 或 hard delete。

## 驗證

- `npm test`：325 passed、1 private-source skipped。
- `npm run lint`、`npm run typecheck`、`npm run build`：通過。
- `npm run test:e2e:manual`：desktop/mobile/android 3/3 通過，測試 server 已停止、disposable schema 已移除。此為既有管理者流程回歸，不是訪客真實登入驗收。
- `node --use-system-ca node_modules/vitest/vitest.mjs run --config vitest.live.config.ts tests/live/moves.test.ts -t 'guest|manual|rate limit'`：7 passed、31 未選取；使用 disposable schema。
- 新測試涵蓋 encrypted cookie 竄改、錯誤 key、過期、身分不符、Auth outage、cookie flags、錯誤 App 密碼、管理操作與直接匯出 API 拒絕、容量並發、達容量後重送及零差盤點限制。
- `npm audit --omit=dev`：0 known vulnerabilities（2026-10-19）；不代表全套開發工具 audit clean。
- `node --use-system-ca scripts/production-smoke.mjs https://inventory-portfolio-lac.vercel.app`：16/16 匿名 HTTPS 檢查通過。
- `node --use-system-ca scripts/guest-production-smoke.mjs`：2026-10-20 以 Edge 完成 12 項訪客遠端檢查，含真實登入、HttpOnly/Secure/Strict cookie、無瀏覽器 Supabase auth cookie、三種 export API 403/no-store、主檔及匯入頁拒絕、Review 拒絕、手動建檔、超量出庫拒絕、IN/OUT、盤點、隱藏沖銷、重整與手機尺寸、竄改 cookie 拒絕、登出後保護。
- 唯讀展示 DB 核對：本次虛構品項四筆 CONFIRMED 異動為 +10、+2、-1、-3，淨庫存 8；四筆 StockMove audit 均由訪客身分記錄。資料及歷史保留。
- JSON 驗收紀錄與截圖位於 ignored `test-results/guest-production-smoke.json`、`test-results/guest-production-stock.png`。本次沒有重跑真實管理者登入、實體手機或所有被禁止的 Server Actions；管理寫入拒絕另由本機 service 測試覆蓋。未進行全面 bundle 敏感資訊掃描，不將 cookie 檢查誇大為完整滲透測試。

## 建立與部署

1. 本機執行 `scripts/setup-guest-account.ps1`，使用者私下輸入 **inventory-v2-dev** 的 Secret/service_role key。金鑰不保存，固定呼叫展示 project Auth Admin API，不觸碰公司正式帳號。
2. 工具建立 `visitor@inventory-demo.invalid` 並標記 email confirmed；此為展示帳號識別字，不用來接收郵件。產生的 Supabase 隨機 backend 密碼只能留在 server。
3. `.env.guest.local` 存放六個 `DEMO_GUEST_*` 私有部署值；`.env.guest-share.local` 只包含可分享的 App Email／密碼與網址。兩檔都不要提交 Git，也不要上傳為靜態檔案。
4. 僅把私有設定透過 Vercel 環境變數加入 `inventory-portfolio` Production，敏感值標為 sensitive。明確指定 project `prj_f6cLtMTAy1XibgKGksOCOJEnJE8X`；本地預設 `.vercel` 仍指向公司原專案。
5. 部署後驗證：訪客登入、cookie 與 bundle 不含原始 Auth token；建檔／IN／OUT／盤點；export 403；主檔／Review／Import／reversal 拒絕；竄改 cookie／登出後保護；原管理者登入回歸。

## 營運限制

- 共同帳號無法識別個別訪客，訪客可更動彼此的虛構庫存。若需要互不干擾，需另做 per-visitor workspace 與資料擁有權設計。
- 全站 login quota 可被故意耗盡，資料庫 limiter 不是 WAF／DDoS 防護；大量公開流量前仍需平台限流或 CAPTCHA。讀取聚合仍在記憶體處理。
- 加密 cookie 本身仍是可重播的 bearer credential。登出會清除本機 cookie，但被竊取副本最多在剩餘 20 分鐘內可用；緊急停用設定 `DEMO_GUEST_ENABLED=false` 或輪替 `DEMO_GUEST_COOKIE_KEY` 並部署。輪替分享密碼時也應輪替 cookie key。
- 不宣稱 HttpOnly 可防止所有 XSS：XSS 仍可能代使用者送出操作。維持 React escaping、不渲染任意 HTML，並持續修補依賴。
- runtime DB 角色仍具較高權限，RLS 不限制 table owner；最小權限專用 DB 角色與災難還原仍為後續工作。

## 官方依據

- [Supabase createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)：僅 server/admin 使用；實作並核對安裝版 GoTrueAdminApi。
- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)：向 Auth server 驗證使用者。
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security)：recent login 可不再要求 password reauthentication，因此不能靠該設定保護公開共用密碼。
