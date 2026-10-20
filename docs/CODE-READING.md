# 程式碼閱讀指南

目前產品是手動建檔的單帳號展示版；功能與環境狀態請先看 [PORTFOLIO.md](PORTFOLIO.md)。原始 V2 規格保留不變。

## 建議閱讀順序

1. `src/app/(workspace)/inventory/new/page.tsx`：伺服器頁面入口。
2. 同目錄 `form.tsx`：使用者輸入、等待狀態、錯誤與成功畫面。
3. 同目錄 `actions.ts`：接收表單、呼叫服務並更新畫面快取。
4. `src/lib/manual/validation.ts`：驗證名稱、單位、位置、數量與 requestId。
5. `src/lib/manual/service.ts`：授權、交易範圍、逾時與安全錯誤處理。
6. `src/lib/manual/transaction.ts`：建立品項、位置、庫存與防重複收據。
7. `src/lib/moves/transaction.ts`：所有庫存異動共用的鎖定、負庫存檢查與 audit。
8. `src/lib/inventory/query.ts`：從已確認期初與異動計算庫存。

## 各層的責任

| 層級 | 責任 | 不能依賴它做什麼 |
|---|---|---|
| React 表單 | 收集輸入、回饋操作結果 | 不能取代伺服器權限或資料驗證 |
| Server Action | 連接畫面與服務、重新驗證快取 | 不代表呼叫者自動有權限 |
| Service | 驗證身分、輸入、設定 transaction | 不可把預覽數量當成提交時庫存 |
| Transaction 核心 | 鎖定、檢查、原子寫入 | 不可被未授權、未驗證的呼叫端直接使用 |
| Query | 計算與讀取資料 | 查詢 helper 本身不提供授權或庫存鎖 |

## 最重要的順序

出庫：授權 → 驗證輸入 → 開啟交易 → 請求鎖 → 檢查重送 → 品項／位置鎖 → 保護主檔 → 新 statement 重讀庫存 → 檢查餘額 → 寫異動與 audit → commit。

`ReadCommitted` 配合取得鎖後的獨立查詢，才能看見前一筆等待中的交易完成後的數量。所有修改庫存的流程都必須遵守相同鎖定協定；transaction 本身不是防超賣的全部。

## 名詞與不變條件

- `actor`：已通過伺服器身分與 Email 白名單驗證的操作者。
- `tx`：同一筆資料庫交易的操作入口；不要改用交易外連線寫入。
- `signedQty`：有正負號的異動量；入庫為正、出庫為負。
- `normalizedQty`：轉換成品項標準單位的數量；不是任意輸入文字。
- `CONFIRMED` 才納入庫存，`NEEDS_REVIEW` 不納入。
- `ManualReceipt`、盤點與 Review 收據用於防重複，不能當一般暫存 log 清除。
- `fingerprint`：比較請求內容的 SHA-256 指紋，不是加密或授權機制。
- `reversal`：新增反向交易更正錯誤，不刪除原交易。
- 零初始數量建立已確認期初紀錄；正數初始數量走入庫核心。
- Preview 永遠禁止寫入；展示站是獨立專案的 Production deployment。

## 技術如何串接

React／Tailwind 負責畫面，Next.js App Router 連接頁面與伺服器流程，TypeScript 檢查程式型別。Supabase Auth 驗證登入，Prisma 經 PostgreSQL adapter 存取 Supabase PostgreSQL；Vercel 執行雲端應用。Runtime 使用 transaction pooler，migration 使用獨立適用連線，不能混用。實際套件版本見 `package.json` 與 lockfile。

## 修改後如何檢查

```powershell
npm test
npm run lint
npm run typecheck
```

若修改鎖定、交易或庫存計算，還需使用開發／展示設定執行 live DB tests；測試程式使用自己的 disposable schema。不可將公司正式資料庫當測試庫。畫面行為變更則再執行對應 Playwright E2E。

中文註解優先解釋限制與原因，不逐行重述語法。閱讀時先追蹤一條完整操作流程，再看其他業務模組，比一次閱讀所有檔案容易。
