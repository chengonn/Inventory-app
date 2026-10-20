# 訪客登入與中英介面（2026-10-20）

## 範圍

- 僅在獨立 portfolio demo 顯示訪客 App Email、分享密碼及「填入訪客帳密」。不開放 signup，也不顯示管理者或 Supabase backend 密碼。
- 登入頁與工作區提供繁體中文／English 切換，涵蓋總覽、查詢、手動建檔、入出庫、盤點、異動紀錄與設定。主檔及既有管理介面亦使用翻譯字典。
- 使用者輸入的品項、單位、區域、位置與備註保留原文。Excel 檔案內容與既有匯入診斷格式不改寫；匯入預設仍停用。

## 程式入口

- `src/lib/i18n/core.ts`：只接受 `zh-Hant`／`en`，未知值回到繁體中文。翻譯 UI 訊息，不修改 API 參數或資料。
- `src/lib/i18n/english.ts`：英文文字對照；測試會檢查所有 `t("...")` UI 字串是否有英文。
- `src/lib/i18n/server.ts`：Server Components 讀取偏好 cookie。
- `src/components/language-provider.tsx`：Client Components 使用 `useT()`；切換更新偏好 cookie 並 refresh RSC，保留 client state。cookie 不具任何授權作用。
- `src/app/layout.tsx`：伺服器設定 `<html lang>` 與頁面 metadata。
- `src/app/login/page.tsx`、`form.tsx`：取得明確允許公開的帳密，顯示並填入登入表單。
- `src/lib/auth/guest.ts`：`publicGuestCredentials()` 先通過既有 demo project pinning，再驗證 `DEMO_GUEST_PUBLIC_PASSWORD` 與 App password hash 相符，且不等於 backend 密碼，才回傳 `{email,password}`。驗證快取只保留一組，避免每個匿名 GET 執行 scrypt。

## 部署設定

僅在 Vercel `inventory-portfolio` 的 Production 設定 `DEMO_GUEST_PUBLIC_PASSWORD`，值來自本機私有分享檔的 **App password**。此值刻意公開給訪客，不能填入 Supabase backend、service-role 或公司正式帳密。缺少、錯誤或非展示設定都不顯示帳密卡。

沒有 schema／migration 變更。公司正式站不部署此版本；本機 `.vercel` 預設連結仍不可當作部署目標依據，CLI 必須明確指定展示 project。

## CIA 與限制

- **C**：只公開訪客 App 密碼。後端密碼、hash、cookie encryption key 不進 client props；管理頁及匯出仍由 server 拒絕。
- **I**：語言僅影響呈現，不更改數量、enum、requestId、交易鎖、收據或 audit。訪客不能藉切換語言取得管理權限。
- **A**：保留登入／寫入限流與展示容量上限；新增公開密碼雜湊檢查快取。公開帳號仍可能被濫用，共用資料會互相影響；不是個別訪客隔離環境。
- 表單輸入在切換語言時保留，但瀏覽器整頁重載不承諾保留未送出內容。
- 不宣稱完成全面滲透測試；其餘已知營運限制見 `GUEST-CIA.md`。

## 本機驗證

- `npm test`：329 passed、1 private-source skipped。
- `npm run lint`、`npm run typecheck`、`npm run build`：通過；最終 build 包含 TypeScript 檢查。
- `npm run test:e2e:manual`：desktop／mobile／android 3/3，驗證中英切換保留輸入、英文建檔及原單位保留。disposable schema 已移除。
- 最終 credential／i18n focused tests：23/23。
- `node --use-system-ca scripts/production-smoke.mjs https://inventory-portfolio-lac.vercel.app`：16/16 匿名 HTTPS 檢查通過。
- `node --use-system-ca scripts/guest-language-smoke.mjs`：6 組遠端驗收全部通過，涵蓋公開 App 帳密卡／填入、中英切換及重整持續、真實訪客登入、HttpOnly/Secure/Strict session、無原始 Supabase auth cookie、填表切換保留內容、英文建檔／IN／OUT／盤點、超量 OUT 英文拒絕、最終庫存 2、手機尺寸無水平溢出、三種匯出 API 403/no-store、管理頁拒絕、設定頁與登出後保護。
- 虛構驗收品項 `Language-demo-1792462579411` 保留在展示庫。本次未另以直接 SQL 核對 audit，未重跑實體手機或真實 owner 登入。
- 紀錄：ignored `test-results/guest-language-smoke.json`；截圖 `guest-login-en.png`、`guest-inventory-en.png` 已人工檢視。

## 已部署版本

2026-10-20：`dpl_EEHEhieixuAYR8uLkkhemCxRxpEU` READY，alias `https://inventory-portfolio-lac.vercel.app`。遠端 build／TypeScript 通過。公司正式 project 未變動。

遠端安裝仍報 5 high 開發工具鏈 advisories（既有 ESLint 相依鏈），本次未做破壞性 dependency 升級，不宣稱全套 audit clean。共享展示庫、公開帳號濫用及缺乏 per-visitor 隔離仍為營運限制。
