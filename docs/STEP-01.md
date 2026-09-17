# Step 1 驗證報告

完成日期：2026-09-05。範圍：V2 §28 Step 1 — Cloud-ready Next.js scaffold。

## 修改檔案

本次在 outputs/inventory-app 建立新專案，未找到或改動既有 V1 程式碼。

- 規格與文件：AGENTS.md、README.md、docs/V2.md、docs/STEP-01.md。
- 套件與設定：package.json、package-lock.json、tsconfig.json、next-env.d.ts、postcss.config.mjs、eslint.config.mjs、vitest.config.ts、playwright.config.ts、.gitignore、.env.example。
- 頁面：src/app/layout.tsx、src/app/page.tsx、src/app/globals.css、src/app/(workspace)/layout.tsx、src/app/(workspace)/dashboard/page.tsx、src/app/(workspace)/[...section]/page.tsx。
- 共用元件：src/components/app-shell.tsx、src/lib/navigation.ts。
- 測試：tests/unit/navigation.test.ts、tests/e2e/scaffold.spec.ts。
- 驗證截圖：docs/screenshots/desktop.png、docs/screenshots/mobile.png、docs/screenshots/android.png。

## 完成功能

- Next.js 16.3.4 App Router、React 19.2.8、TypeScript 5.9.3、Tailwind CSS 4.3.3。
- 繁體中文桌面側欄、手機 modal drawer、Escape 關閉、焦點管理、略過導覽連結。
- V2 的 11 個工作區入口；搜尋、入庫、出庫、盤點四個大型入口。
- Dashboard 使用明確的未連線狀態，不填入 mock 庫存。
- 尚未實作功能頁清楚標示未啟用，未知路由回 404，沒有 signup UI。
- .env* 與原始 Excel 排除於 Git，僅保留空白 .env.example。
- V2 原文副本 SHA-256 與下載來源一致；規範明確廢止 V1 SQLite/LAN/PIN 架構。

## Migration 變更

無。Step 1 未安裝 Prisma、未建立 schema、未連接或修改任何資料庫。

## 測試命令與結果

於專案根目錄執行；本機先將 C:\Program Files\nodejs 放到目前 PowerShell PATH 前端，避開損壞的 Roaming npm。下載套件時使用 NODE_OPTIONS=--use-system-ca，保留 TLS 驗證。

| 命令／檢查 | 結果 |
|---|---|
| npm install --save-exact | 成功；395 packages；npm audit 0 vulnerabilities |
| npm run lint | 通過，exit 0，零 warning |
| npm run typecheck | 通過，exit 0 |
| npm test | 2/2 通過，exit 0 |
| npm run build | 通過，exit 0 |
| npm run dev -- --port 3001 | Ready；GET /dashboard HTTP 200 |
| npm run start -- --port 3002 | production build 啟動成功 |
| $env:E2E_BASE_URL='http://localhost:3002'; npm run test:e2e | 6/6 通過，18.1 秒，exit 0 |
| V2 原文／副本 hash 比對 | 一致 |
| 桌面與 Android 截圖人工檢查 | 無水平溢出，文字及卡片顯示正常 |

E2E 涵蓋 desktop 1280×720、iPhone 13 尺寸 390×664、Android 360×800 的 Chromium viewport，包含導覽、drawer 關閉、Escape、四個入口導向、最小 44px 觸控目標、signup 404。

修正與重跑紀錄：
- lint 首次發現 PostCSS anonymous default export warning，修正後通過。
- 最初 Playwright 自動管理 webServer 時，6 項斷言通過但 teardown 不結束；人工中止該次程序，不算成功。
- 改以既有 dev server 重跑，首次按需編譯耗時約 7–10 秒，超過斷言 5 秒等待，6 項失敗；未忽略此結果。
- 最終改為明確啟動 production build，再執行 E2E，6 項通過且程序正常退出。設定已移除自動 webServer，README 提供可重現指令。

## 尚存風險

- 目前沒有 Auth、資料庫、真實庫存、入出庫、盘點、Excel import/export；尚未部署 Vercel。
- 工作區目前只展示公開 scaffold，不具備 protected route 保護。Step 4 完成前不得接入或部署真實業務資料。
- E2E 手機測試使用 Chromium 模擬 viewport，尚未驗證實體手機或 Safari，亦非 production smoke test。
- ESLint 9.39.5 安裝時提示已停止支援；目前 eslint-config-next 所依賴的 eslint-plugin-react peer range 仍到 ESLint 9，未強制升級不相容版本。後續留意官方相容更新。
- npm 提示 unrs-resolver optional postinstall 尚未核准；現有 lint、typecheck、build 均成功，未額外執行未必要的 script。
- Supabase project、白名單 email、dev/preview/production 連線與 Vercel project 尚未設定。秘密值不應貼入聊天或 Git。

## 下一步

Step 2：Supabase project integration。依實際安裝版本官方文件建立 browser/server utilities 與 Auth 基礎，設定安全的 session cookie 處理；驗證後才進 Step 3 Prisma PostgreSQL schema 與 migration。完整登入與 allowed-email guard 屬 Step 4。
