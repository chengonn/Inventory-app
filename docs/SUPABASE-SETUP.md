# Supabase Step 2：設定與使用

2026-09-08：開發專案已建立，公開 signup 已關閉、匿名登入關閉，白名單已設定。Step 4 程式與本機測試完成，真實帳號驗收尚待完成，見 [Step 4 報告](STEP-04.md)。下列為早期設定步驟與 utilities 說明。

## 建立開發專案後

1. 從 Supabase Dashboard 建立開發專案。Preview 不要默默使用 production database。
2. 在 Connect / API Keys 取得 Project URL 與 publishable key（sb_publishable_ 開頭）。本實作明確使用新 publishable key，不接受 legacy anon JWT 或 secret/service-role key。
3. 在本專案根目錄複製 `.env.example` 為 `.env.local`，填寫 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。本步驟不需要 DATABASE_URL、DIRECT_URL 或 service-role key。
4. 在 Auth 的 Sign In / Providers 一般設定關閉 **Allow new users to sign up** 與 **Allow anonymous sign-ins**。僅隱藏 signup 頁不能關閉 Supabase 的公開 signup API。保留 Email + Password；初始使用者由 Dashboard 管理者建立。
5. `ALLOWED_USER_EMAIL` 在 Step 4 設定並實作 server-side guard；目前尚未限制 email，所以不可部署真實資料。
6. 重新啟動 dev。正式 build 前需先設定 public 變數，因 Next.js 會在 build 時內嵌它們；改設定後需要重新 build/deploy。

未填 URL/key 時，編譯仍可完成，但 Proxy 對頁面與 API 回 503、禁止快取。只填一個值、使用 HTTP URL 或誤填 secret 時，predev/prebuild 會中止。這個檢查只確認格式，不能證明 project 存在或 key 有效。

## Utilities 責任

| 檔案 / 方法 | 使用位置 | Cookie 行為 |
|---|---|---|
| src/lib/supabase/client.ts → createClient | Client Component 的 Auth 功能 | 使用 SDK 的 browser cookie storage 與 browser singleton |
| src/lib/supabase/server.ts → createClient | Server Component，只讀 | 讀取 await cookies()；refresh 持久化由 Proxy 負責 |
| src/lib/supabase/server.ts → createActionClient | Server Action | 可寫入 cookie；寫入錯誤向上拋出，不能用在 RSC |
| src/lib/supabase/route-handler.ts → createRouteClient(request, response) | Route Handler | 同步 request/response cookies，將 SDK cache headers 寫入指定 response；最後必須回傳該 response |
| src/lib/supabase/proxy.ts → updateSession | src/proxy.ts | 在頁面 render 前 getClaims，更新 request 與 response cookie，保留多次 setAll 的 chunks 與第一批 cache headers |

Server client 每個 request 建立，不存於全域變數。所有 business data 將由 Prisma server services 處理，不使用 browser Supabase Data API。

Proxy 是 session refresh 基礎，**不是 authorization guard**。目前匿名／無效 session 不取得任何授權身分，但仍可見未含資料的 scaffold。Step 4 須在 protected pages 與所有 mutation/read endpoints 再驗證身份與 allowed email，不能只依賴 Proxy；不可把 getSession() 裡的 user 當驗證結果。getClaims 驗證 JWT，不保證能立即識別後台撤銷的 session；敏感操作的即時使用者狀態驗證在 Step 4 處理。

## Cookie 與快取決策

- Path=/、不設定 Domain（host-only）、SameSite=Lax。production 使用 Secure，dev 可在 localhost HTTP 使用。
- HttpOnly=false 是這次採用 browser/server 共享 Supabase SSR 模式的明確選擇，browser SDK 需要讀取／刷新 token。Cookie 中不是 database/service-role credentials。
- 沿用 SDK 的分段 cookie、編碼、期限與刪除行為，不自行縮短 Max-Age、不手算 cookie 名稱。
- Proxy 所匹配的頁面/API 一律 private/no-store，含 Server Action。RSC workspace force-dynamic，禁止 ISR 儲存 session response。
- Route Handler 會採用 SDK setAll 的第二個參數 cache headers；Server Action 無法用 Next headers() 寫 response header，統一依賴 Proxy 的強制 no-store，未來新增 Action 路徑不可跳過 Proxy。
- Auth 連線錯誤／限流回 503，不回傳 SDK stack 或 token。invalid refresh token 的清除 cookie 由 SDK 產生並保留。
- Server Component 使用只讀 client 不做 signIn/signOut/updateUser；相關操作必須使用 Action 或 Route Handler utility，且在送出 response 前 await 完成。

## 官方來源與安裝版本

本步驟鎖定 @supabase/ssr 0.12.6、@supabase/supabase-js 2.115.0、Next.js / @next/env 16.3.4，並讀取實際套件 src/types.ts、createServerClient.ts、createBrowserClient.ts。

- [Supabase SSR client / Proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase SSR cookie/cache 與 request isolation](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase API key 類型](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase 關閉公開 signup 設定](https://supabase.com/docs/guides/auth/general-configuration)
- Next.js 已安裝版文件：node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md、04-functions/cookies.md。

注意 Next.js 16.3.4 附帶 docs 稱測試方法為 unstable_doesProxyMatch，但實際 exported types/runtime 仍為 unstable_doesMiddlewareMatch。本專案測試依實際已安裝的 export 使用後者；執行檔案仍使用正確的 src/proxy.ts convention。
