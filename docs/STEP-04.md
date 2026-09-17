# Step 4 Authentication（2026-09-08）

Step 4 程式、本機測試、隔離 Auth 桌面／手機 E2E 與真實帳號登入／登出驗收已完成。

## 修改檔案與功能

- src/lib/auth/policy.ts、guard.ts：以 Auth server 的 getUser 驗證身分、已確認 Email、非匿名帳號與 server-only ALLOWED_USER_EMAIL；缺少白名單或 Auth 異常時拒絕授權。
- src/app/login/page.tsx、form.tsx、actions.ts：Email/password 登入、一般錯誤提示、pending 狀態、固定 dashboard redirect、local scope 登出；沒有 signup 或不完整的自助重設密碼流程。
- src/app/(workspace)/layout.tsx、dashboard/page.tsx、[...section]/page.tsx：layout 與各頁獨立 guard。後續資料 service、Server Action、Route Handler 仍須每次獨立驗證 actor，不能只依靠 layout/Proxy。
- src/lib/supabase/proxy.ts：保留 refresh cookie/cache header，對已有 verified claims 的 session 再查 getUser；非白名單清除 session，頁面導向 login、API 回 403。
- src/app/api/auth/session/route.ts：不回傳個資/token 的驗證端點，allowed 204、anonymous 401、forbidden 403、服務/設定異常 503；保留 refresh cookies、no-store。
- src/components/app-shell.tsx：桌面與手機均可使用登出按鈕。
- tests/unit/auth.test.ts、auth-route.test.ts、tests/integration/supabase-refresh.test.ts：guard、錯誤處理、登出、非白名單 cookie 清除與 HTTP 狀態。
- tests/e2e/auth.spec.ts、tests/fixtures/auth-transport.cjs、playwright.config.ts：新增隔離登入 E2E。fixture 僅能以 Node preload 明確啟用且限 .invalid host，app 不引用；沒有 runtime 認證 bypass 開關。
- .env.local：唯一白名單 Email 已按使用者提供值設定；不追蹤、不回傳至 client。

## 雲端設定與帳號

開發專案已關閉 Allow new users to sign up；Allow anonymous sign-ins 原已關閉，Confirm email 保持開啟。Email/password provider 可用，Data API 保持關閉。

Supabase Dashboard 帳號、PostgreSQL database password、庫存 App 帳號是三種不同用途。庫存 App 密碼由管理者在 Authentication → Users → Add user → Create new user 設定。Email 必須等於 ALLOWED_USER_EMAIL，保留 Auto confirm user；密碼由使用者自行設定並保存，不放 .env.local 或對話。忘記密碼由 Dashboard 管理流程處理。

## Migration

無新增或修改 migration；不更改 Supabase auth schema。Step 3 的兩份 migration 保持不變。

## 驗證

| 命令 | 結果 |
| --- | --- |
| npm test | 119/119 通過，14 個測試檔 |
| npm run lint | 通過 |
| npm run typecheck | 通過 |
| npm run build | 通過；最後已恢復使用真實開發專案的 public 設定編譯 |
| 真實設定 production build：E2E_BASE_URL=http://127.0.0.1:3034，npm run test:e2e | 匿名保護 3/3 通過；另 6 項 fixture 測試依條件略過 |
| 隔離 Auth dev server：E2E_BASE_URL=http://127.0.0.1:3035、E2E_AUTH_FIXTURE=1，npm run test:e2e -- --workers=1 | 9/9 通過，含桌面、iPhone 尺寸、Android 尺寸 |

後續回合已成功啟動兩個獨立測試 server。3035 fixture dev server 測完已停止；3034 真實設定 production server 已完成登入／登出驗收，隨後停止。沒有停止使用者自己的 dev server。119 項測試包含 mock Auth 與真實 SDK 搭配離線 HTTP fixture，不能代替真實登入驗收。

## 驗收與風險

請先完成 Dashboard App 帳號建立，再重新啟動原有 dev server 以載入 ALLOWED_USER_EMAIL。使用該 App Email/password 登入 /login，確認 /dashboard、重新整理、/login 自動轉回 dashboard、登出及再次訪問 protected page 的行為。

獨立 production build 的匿名 E2E 可由使用者在本目錄啟動 `node --use-system-ca node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3034`，再以 E2E_BASE_URL=http://127.0.0.1:3034 執行 npm run test:e2e。真實帳密不寫入測試 fixture。

隔離 E2E 完整流程需在 build 與 start 均設定 NEXT_PUBLIC_SUPABASE_URL=https://inventory-test.invalid、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_test_only、ALLOWED_USER_EMAIL=owner@example.com；start 用 Node `--require ./tests/fixtures/auth-transport.cjs`，Playwright 設 E2E_AUTH_FIXTURE=1。結束後停止服務並重新以真實設定 build。

隔離 Auth 在 Chromium 的三種 viewport 已驗證登入、登出、白名單與 API；這不是實體 iPhone Safari 驗收。真實帳號登入、重新整理保留 session、已登入訪問 /login 自動轉至 /dashboard、登出、登出後 protected page 阻擋均已驗證。長時間 token 到期 refresh 仍由 SDK 離線整合測試覆蓋，未等待真實 token 到期。Supabase rate limit 由服務端提供，UI 顯示 429 錯誤；本版沒有跨 instance 自建限流。SameSite=Lax、production Secure、SSR cookie 仍依 Step 2 設計可由 browser SDK 讀取；沒有 client DB credentials。

下一步：完成 Step 4 真實登入與 E2E 驗收後，才進 Step 5 主檔管理。庫存聚合、並發出庫、Excel 匯入、Vercel 部署仍在後續步驟。

## 官方依據

- [Supabase getUser：向 Auth server 驗證使用者](https://supabase.com/docs/reference/javascript/auth-getuser)
- [signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
- [signOut local scope](https://supabase.com/docs/reference/javascript/auth-signout)
- 已安裝 Next.js 16.3.4 的 authentication.md、redirect.md：Server Actions、redirect 置於 try/catch 外、各資料入口授權。

E2E 首次發現 Next.js route announcer 也使用 role=alert，已以訊息文字縮小定位範圍。dev server 六 workers 冷編譯曾造成一次 5 秒等待逾時；改為 --workers=1 後 9 項一次全通過。

## 真實登入 TLS 排查

2026-09-08：使用者在既有 localhost dev 可登入，但獨立 3034 production server 登入失敗。相同實際 Supabase URL 的 /auth/v1/settings 在普通 Node 回 UNABLE_TO_VERIFY_LEAF_SIGNATURE；加入 --use-system-ca 後 HTTP 200。已停止原 3034 server，並以 Node --use-system-ca 重新啟動。未停用 TLS 驗證、未修改密碼或雲端憑證。此為本機 Node 信任鏈設定；真實登入仍需使用者重試後驗收。

## 真實帳號驗收完成

使用者在 Codex 分頁以自行設定的 App 密碼登入，實際看到 /dashboard；重新整理仍為 dashboard；訪問 /login 轉回 dashboard。代理按下登出後，頁面為 /login?reason=signed_out 並顯示「已登出」；再次訪問 /dashboard 被轉至 /login。全程未讀取或記錄密碼/token。Step 4 已驗收，可進 Step 5 主檔管理。
