// Chinese source messages are stable keys; translations never change API values.
export const english: Record<string, string> = {
  "服務暫時無法使用。若確認結果不明，請以相同資料重試，系統會防止重複寫入。":
    "Service temporarily unavailable. If confirmation is uncertain, retry with the same data; duplicate writes are prevented.",
  "品項名稱已存在。補貨請使用入庫；不同單位請建立不同名稱的品項。":
    "This item name already exists. Use Receive stock for deliveries; create a differently named item for a different unit.",
  "僅支援來源範本的「品項設定、InventoryData、StockMoves、移除紀錄」。上傳後先預覽，勾選確認才寫入庫存。上限 3 MB／2000 筆；未知換算或單位列為待確認，不計入庫存。既有主檔不覆寫、既有期初不可再次疊加。":
    "Only the original workbook template is supported. Preview and acknowledge before importing. Limit: 3 MB / 2,000 records. Unknown units or conversions require review and are excluded from stock. Existing master data is not overwritten; existing opening stock cannot be added again.",
  "匯入完成：批次": "Import complete, batch ",
  "、期初": ", openings ",
  "、異動": ", movements ",
  "、移除歷史": ", archived ",
  "、待確認": ", review ",
  上傳下一份: "Upload another file",
  "無法取得預覽，請檢查檔案大小與連線後重試。":
    "Unable to preview. Check file size and connection, then retry.",
  "Excel 檔案": "Excel file",
  "預覽 Excel": "Preview Excel",
  "Excel 匯入預覽": "Excel import preview",
  匯入預覽: "Import preview",
  "筆／待確認": " records / needs review ",
  "筆；移除歷史不影響庫存。":
    " records; archived history does not affect stock.",
  "此檔案已匯入（批次": "This file was already imported (batch ",
  錯誤: "Errors",
  "／提醒": " / Warnings ",
  提醒: "Warnings",
  "品項主檔預覽（": "Item preview (",
  "筆）": " records)",
  "· 單位": " · Unit ",
  "· 安全庫存": " · Safety stock ",
  預覽資料列: "Preview rows",
  移除歷史: "Archived history",
  未知: "Unknown",
  "· 庫存增減": " · Stock change ",
  不計入: "Excluded",
  "移除原因：": "Archive reason: ",
  "· 原始位置": " · Original location ",
  預覽分頁: "Preview pagination",
  匯入後的已確認庫存預估: "Expected confirmed stock after import",
  "預覽有效 30 分鐘。確認時會重新檢查庫存；期間資料若改變，匯入可能被拒絕。":
    "Previews expire after 30 minutes. Stock is rechecked on confirmation; changes may cause import rejection.",
  "我已核對資料、位置與待確認提醒，同意將此整批資料匯入。":
    "I have checked the data, locations and review warnings, and confirm importing this batch.",
  "連線中斷，請查閱匯入紀錄或重試；相同檔案不會重複寫入。":
    "Connection interrupted. Check import history or retry; the same file will not be written twice.",
  "匯入中…": "Importing…",
  確認匯入: "Confirm import",
  "無法確認匯入。請修正錯誤後重新上傳。":
    "Unable to confirm import. Correct the errors and upload again.",
  "嘗試次數過多，請稍後再試。": "Too many attempts. Please retry later.",
  "登入驗證失敗，請稍後再試。":
    "Sign-in verification failed. Please retry later.",
  "暫時無法儲存，請稍後以相同資料重試。":
    "Unable to save. Retry later with the same data.",
  "每次請填寫 1 至 50 個品項的實際數量，未盤點的欄位請留空。":
    "Enter counts for 1 to 50 items. Leave uncounted items blank.",
  "服務暫時無法使用。若確認結果不明，請以相同內容重試，勿重新建立盤點。":
    "Service temporarily unavailable. If confirmation is uncertain, retry with the same content rather than starting a new stocktake.",
  "處理中…": "Processing…",
  品項: "Item",
  "請輸入有效的 Email 與密碼。": "Enter a valid email and password.",
  "無法登入，請確認帳號密碼或稍後再試。":
    "Unable to sign in. Check your credentials or try again later.",
  "無法安全切換帳號，請稍後再試。":
    "Unable to switch accounts safely. Please retry later.",
  "訪客可體驗建檔、入出庫與盤點；此功能僅供管理者使用。":
    "Guests can create items, receive or issue stock, and take stock. This feature is for administrators only.",
  "主檔管理僅供管理者使用；訪客請從新增品項與庫存開始。":
    "Master data management is for administrators only. Guests can start with Add item & stock.",
  "品項或位置剛被建立，請重新查詢後再試。":
    "The item or location was just created. Search again before retrying.",
  "此請求已用於其他資料，請重新整理後再新增。":
    "This request was used for different data. Refresh before creating another item.",
  "此位置已停用，請使用其他位置或先重新啟用。":
    "This location is inactive. Use another location or reactivate it first.",
  "欄位格式錯誤。": "Invalid field format.",
  "請指定啟用狀態。": "Specify an active status.",
  "主檔編號無效。": "Invalid master record ID.",
  "版本無效，請重新整理。": "Invalid version. Please refresh.",
  "此環境僅供查詢，已停用庫存與主檔寫入。":
    "This environment is read-only. Inventory and master data writes are disabled.",
  "沒有操作權限或登入已失效，請重新登入。":
    "Access denied or session expired. Please sign in again.",
  "找不到此主檔，請重新整理。": "Master record not found. Please refresh.",
  "資料已被更新，請重新整理後再修改。":
    "The record was updated. Refresh before editing again.",
  "儲存失敗，請稍後再試。": "Unable to save. Please retry later.",
  "異動篩選欄位格式無效。": "Invalid movement filters.",
  "日期格式須為 YYYY-MM-DD。": "Use YYYY-MM-DD for dates.",
  "日期不存在。": "Invalid date.",
  "開始日期不可晚於結束日期。": "Start date must not be after end date.",
  "登入已失效或沒有交易權限，請重新登入。":
    "Session expired or transaction access denied. Please sign in again.",
  "品項或櫃位不存在或已停用。":
    "The item or location does not exist or is inactive.",
  "已確認庫存不足，請減少出庫數量。":
    "Insufficient confirmed stock. Reduce the issue quantity.",
  "訪客只能建立已確認的標準數量交易。":
    "Guests can only create confirmed transactions with known quantities.",
  "找不到品項或櫃位。": "Item or location not found.",
  "品項或櫃位已停用，請重新選擇。":
    "The item or location is inactive. Choose another.",
  "此請求編號已用於不同交易，請重新建立交易。":
    "This request ID was used for another transaction. Create a new transaction.",
  "已確認庫存不足，交易未寫入。請重新預覽。":
    "Insufficient confirmed stock. Nothing was written. Preview again.",
  "此請求編號已用於不同交易。":
    "This request ID was used for another transaction.",
  "此交易已沖銷，不可重複沖銷。": "This transaction has already been reversed.",
  "沖銷後庫存會小於零，交易未寫入。":
    "The reversal would cause negative stock. Nothing was written.",
  "品項、櫃位或交易編號無效。": "Invalid item, location or transaction ID.",
  "數量須為非負十進位數，最多 15 位整數與 3 位小數。":
    "Quantity must be nonnegative, with at most 15 integer digits and 3 decimal places.",
  "請求編號無效，請重新整理。": "Invalid request ID. Please refresh.",
  "交易類型無效。": "Invalid transaction type.",
  "交易數量必須大於零。": "Transaction quantity must be greater than zero.",
  "容器數必須大於零。": "Container count must be greater than zero.",
  "出庫必須知道標準數量，未知容器數量不能支撐出庫。":
    "Issuing stock requires a known standard quantity. Unknown container quantities cannot be issued.",
  "換算數量須大於零且不可超過資料庫精度上限。":
    "Converted quantity must be positive and within database precision limits.",
  "數量輸入方式無效。": "Invalid quantity input method.",
  "展示資料已達容量上限，請聯絡專案作者；目前仍可查詢。":
    "The demo has reached its capacity. Contact the project author; browsing remains available.",
  "操作次數過多，請等候一分鐘再試。":
    "Too many requests. Wait one minute before retrying.",
  "櫃位不存在或已停用。": "The location does not exist or is inactive.",
  "此盤點請求已用於不同內容，請建立新盤點。":
    "This stocktake request was used for different data. Start a new stocktake.",
  "盤點品項或數量格式錯誤。": "Invalid stocktake item or quantity.",
  "盤點品項不可重複。": "Stocktake items must not be duplicated.",
  "盤點差額超出單筆交易精度上限，未寫入任何盤點交易。":
    "The count difference exceeds transaction precision limits. No movements were written.",
  暫時無法載入頁面: "Unable to load this page",
  "請稍後重試。若剛才已送出庫存操作，請先查看異動紀錄，避免另建一筆相同交易。":
    "Please retry later. If you submitted a stock operation, check movement history before creating another transaction.",
  重新載入: "Reload",
  "訪客體驗：共用虛構資料；可建檔、入出庫與盤點，禁止管理、沖銷及匯出。登入有效期最長 20 分鐘，到期請重新登入。":
    "Guest demo: shared fictional data. Create items, receive or issue stock, and take stock. Administration, reversals and exports are disabled. Sessions last up to 20 minutes; sign in again when yours expires.",
  "作品展示版：請只輸入虛構資料。可從「新增品項與庫存」開始體驗，再操作入庫、出庫與盤點。":
    "Portfolio demo: use fictional data only. Start with Add item & stock, then try receiving, issuing and stocktaking.",
  "此環境僅供查詢，新增、修改與匯入已停用。":
    "Read-only environment: creating, editing and importing are disabled.",
  密碼: "Password",
  "登入中…": "Signing in…",
  登入: "Sign in",
  "登入設定尚未完成，請聯絡管理者。":
    "Sign-in configuration is incomplete. Contact the administrator.",
  "登出未完成，請重試。": "Sign-out failed. Please retry.",
  "此帳號無權使用本系統。":
    "This account is not authorized to use this system.",
  "登入服務暫時無法使用，請稍後再試。":
    "Sign-in is temporarily unavailable. Please retry later.",
  "已登出。": "You have signed out.",
  "庫存管理 V2": "Inventory V2",
  登入庫存管理: "Sign in to Inventory",
  "作品展示版。請使用專案作者提供的展示帳號與密碼，登入後可手動建立品項及體驗庫存操作。":
    "Portfolio demo. Sign in with the demo account to create items and try inventory workflows.",
  "僅限授權帳號使用。忘記密碼請聯絡管理者。":
    "Authorized accounts only. Contact the administrator if you forget your password.",
  登出目前帳號: "Sign out of this account",
  訪客帳號: "Guest account",
  訪客體驗帳號: "Try the guest demo",
  "帳號：": "Email: ",
  "密碼：": "Password: ",
  "共用虛構資料；可建檔、入出庫與盤點，無管理及匯出權限。請勿輸入個人或公司資料。":
    "Shared fictional data. Create items, receive or issue stock, and take stock. No administration or exports. Do not enter personal or company information.",
  填入訪客帳密: "Fill guest credentials",
  入庫: "Receive stock",
  出庫: "Issue stock",
  盤盈: "Stock gain",
  盤損: "Stock loss",
  沖銷: "Reversal",
  工作總覽: "Dashboard",
  總覽: "Dashboard",
  "暫時無法讀取總覽，請重新整理或重新登入。":
    "Unable to load the dashboard. Refresh or sign in again.",
  品項總數: "Total items",
  有庫存品項數: "Items in stock",
  低於安全庫存品項數: "Items below safety stock",
  待確認筆數: "Records needing review",
  今日入庫筆數: "Receipts today",
  今日出庫筆數: "Issues today",
  庫存統計: "Inventory statistics",
  查看低庫存: "View low stock",
  "包含停用品項與櫃位歷史。有庫存＝已確認總量大於零；今日筆數只計台北時間當日的已確認 IN／OUT，沖銷另列歷史。":
    "Includes inactive items and location history. In stock means a positive confirmed total. Today's counts include confirmed IN/OUT in Taipei time; reversals appear separately in history.",
  快速操作: "Quick actions",
  最近異動: "Recent movements",
  "最近 10 筆異動": "Latest 10 movements",
  全部異動: "All movements",
  未知數量: "Unknown quantity",
  已確認: "Confirmed",
  "待確認（不計庫存）": "Needs review (excluded from stock)",
  已忽略: "Ignored",
  "尚無異動紀錄。": "No movements yet.",
  "讀取時間：": "As of: ",
  "（台北）": " (Taipei)",
  匯出備份: "Export & backup",
  "下載庫存與歷史紀錄。新增資料請使用「新增品項與庫存」。":
    "Download stock and history. To create data, use Add item & stock.",
  "無法載入匯入紀錄，請確認登入與資料庫連線後重試。":
    "Unable to load import history. Check your session and connection, then retry.",
  "Excel 匯入／匯出": "Excel import / export",
  "最近 20 次匯入": "Latest 20 imports",
  "尚無匯入紀錄。": "No imports yet.",
  批次: "Batch",
  "· 品項": " · Items ",
  "· 期初": " · Openings ",
  "· 異動": " · Movements ",
  "· 待確認": " · Review ",
  庫存查詢: "Inventory",
  "暫時無法讀取庫存，請重新整理或重新登入。":
    "Unable to load inventory. Refresh or sign in again.",
  匯出符合條件的庫存: "Export filtered inventory",
  共: "Total: ",
  "個品項。低庫存＝全櫃位已確認總量低於安全庫存，包含停用歷史；搜尋櫃位不改變品項總量。":
    " items. Low stock means the confirmed total across all locations is below safety stock, including inactive history. Location searches do not change item totals.",
  "待確認數量不計入；零代表已確認帳面數量，並非實物盤點結果。":
    "Pending quantities are excluded. Zero is the confirmed book quantity, not a physical stock count.",
  已停用: "Inactive",
  全櫃位總量: "Total across locations: ",
  "安全庫存：": "Safety stock: ",
  未設定: "Not set",
  低庫存: "Low stock",
  尚無已確認庫存紀錄: "No confirmed stock history",
  待確認: "Needs review",
  "筆（不計入庫存）": " records (excluded from stock)",
  "（櫃位已停用）": " (inactive location)",
  已確認數量: "Confirmed quantity: ",
  期初: "Opening ",
  "＋ 淨異動": " + Net movement ",
  無已確認流水: "No confirmed transactions",
  此櫃位待確認: "Pending at this location: ",
  筆: " records",
  "沒有符合條件的庫存資料。": "No matching inventory.",
  庫存分頁: "Inventory pagination",
  上一頁: "Previous",
  第: "Page ",
  頁: "",
  下一頁: "Next",
  "無法載入異動紀錄。": "Unable to load movement history.",
  異動紀錄: "Movement history",
  "筆，每頁 50 筆；匯出包含所有符合條件的頁面。已確認交易保留原紀錄，以沖銷更正。":
    " records, 50 per page. Exports include all matching pages. Confirmed records are retained and corrected by reversal.",
  "尚無交易紀錄。": "No transactions yet.",
  異動分頁: "Movement pagination",
  "待確認清單暫時無法載入，請稍後重試。":
    "Unable to load review records. Please retry later.",
  待確認資料: "Records needing review",
  "筆；這些數量尚未計入已確認庫存。":
    " records; these quantities are excluded from confirmed stock.",
  搜尋待確認資料: "Search review records",
  "品項、位置或原文": "Item, location or original text",
  搜尋: "Search",
  "沒有待確認資料。": "No records need review.",
  "原文：": "Original text: ",
  未填: "Not provided",
  "來源：": "Source: ",
  "數量或換算資訊尚未確認，請核對原始紀錄與實物。":
    "Quantity or conversion is unconfirmed. Check the original records and physical stock.",
  原單位: "Original unit ",
  "／主檔單位": " / Item unit ",
  待確認分頁: "Review pagination",
  帳號與使用說明: "Account & help",
  目前帳號: "Current account",
  "作品展示環境，請只使用虛構資料。":
    "Demo environment. Use fictional data only.",
  "私人庫存工作空間。": "Private inventory workspace.",
  "目前僅供查詢，無法修改資料。": "Read-only access. Changes are disabled.",
  "可新增品項及操作入庫、出庫與盤點。":
    "You can add items, receive and issue stock, and perform stocktakes.",
  "帳號與密碼由專案作者管理。若共用同一帳號，異動紀錄無法區分實際操作者。":
    "Accounts are managed by the project author. A shared account cannot identify individual operators in movement history.",
  如何開始: "Getting started",
  新增品項與庫存: "Add item & stock",
  "：填寫名稱、數量、單位與位置。":
    ": enter a name, quantity, unit and location.",
  "補貨使用入庫、領用使用出庫、核對實際數量使用盤點。":
    "Receive stock for deliveries, issue stock for withdrawals, and use stocktake to record physical counts.",
  "交易錯誤請聯絡專案作者；訪客無法沖銷或管理其他資料。":
    "Contact the project author to correct errors. Guests cannot reverse transactions or manage other data.",
  "交易錯誤請到異動紀錄沖銷，保留可追溯的歷史。":
    "Correct errors with a reversal in movement history to preserve the audit trail.",
  "建立後不可直接變更單位；不同單位請另建品項。":
    "Units cannot be changed after creation. Create a separate item for a different unit.",
  "暫時無法讀取盤點資料，請重新載入。":
    "Unable to load stocktake data. Please reload.",
  盤點: "Stocktake",
  "依櫃位核對實際數量；確認時重新計算差額並保留歷史。":
    "Count physical stock by location. Differences are recalculated on confirmation and history is retained.",
  櫃位: "Location",
  選擇櫃位: "Select a location",
  載入盤點表: "Load count sheet",
  "請選擇啟用中的櫃位。": "Select an active location.",
  庫存工作空間: "Inventory workspace",
  功能尚未啟用: "Feature unavailable",
  "此功能將於後續步驟啟用，目前無法讀取或提交庫存交易。":
    "This feature is not available yet. Transactions cannot be read or submitted here.",
  已建立品項與庫存: "Item and stock created",
  "之後補貨請使用入庫；核對實際數量請使用盤點。":
    "Use Receive stock for future deliveries and Stocktake for physical counts.",
  查看庫存: "View inventory",
  再新增一個品項: "Add another item",
  品項與初始庫存: "Item and initial stock",
  品項名稱: "Item name",
  "例如：A4 影印紙": "e.g. A4 paper",
  初始數量: "Initial quantity",
  單位: "Unit",
  "例如：包、個、公斤": "e.g. pack, piece, kg",
  "填入這個位置目前的實際數量，可為 0，最多 3 位小數。新增後不會覆蓋其他品項。":
    "Enter the physical quantity at this location. Zero and up to 3 decimal places are allowed. Other items are not overwritten.",
  區域: "Area",
  "例如：辦公室": "e.g. Office",
  位置: "Location",
  "例如：A 櫃第 2 層": "e.g. Cabinet A, shelf 2",
  "備註（選填）": "Notes (optional)",
  "儲存中…": "Saving…",
  建立品項與初始庫存: "Create item & initial stock",
  "手動填寫品項、數量、單位與位置，一次完成建檔。已有的品項要補貨，請使用":
    "Enter the item, quantity, unit and location. For deliveries of an existing item, use ",
  "選擇品項與櫃位，預覽後確認新增庫存。":
    "Choose an item and location, preview, then confirm the receipt.",
  "僅可領用已確認庫存，確認時會再次檢查剩餘數量。":
    "Only confirmed stock can be issued. Available stock is checked again on confirmation.",
  主要導覽: "Main navigation",
  跳至主要內容: "Skip to main content",
  內部庫存管理: "Inventory management",
  "雲端版 V2": "Cloud V2",
  工作空間: "Workspace",
  庫存管理: "Inventory",
  登出: "Sign out",
  開啟導覽: "Open navigation",
  選單: "Menu",
  關閉導覽: "Close navigation",
  關閉: "Close",
  庫: "I",
  設定: "Settings",
  "無法下載，請確認登入與網路後重試。":
    "Unable to download. Check your session and connection, then retry.",
  "產生 Excel…": "Generating Excel…",
  "Excel 匯出與備份": "Excel export & backup",
  "完整備份保留主檔、期初、異動、待確認、移除歷史、audit 與匯入批次。數量以文字保留精度，日期為 UTC。備份供追溯與管理員還原，不能直接當作初始匯入範本。":
    "Full backups include master data, openings, movements, review records, archive history, audits and import batches. Quantities are text to retain precision; dates are UTC. Backups support auditing and administrator recovery, not direct re-import.",
  匯出庫存現況: "Export current stock",
  匯出全部異動: "Export all movements",
  "下載完整 Excel 備份": "Download full Excel backup",
  "上限 10000 列／4 MB；超限會拒絕，不截斷資料。需要篩選請至庫存查詢或異動紀錄頁。資料庫備份與 PITR 仍須依":
    "Limit: 10,000 rows / 4 MB. Oversized exports are rejected, never truncated. Filter from Inventory or Movement history. Database backups and PITR depend on ",
  "Supabase 目前方案": "your Supabase plan",
  "確認。": ".",
  "搜尋品項、區域或櫃號": "Search item, area or cabinet",
  "例如：膠帶、A 區、櫃號": "e.g. tape, Area A, cabinet",
  僅看低庫存: "Low stock only",
  安全庫存: "Safety stock",
  櫃號: "Cabinet",
  顯示名稱: "Display name",
  狀態: "Status",
  啟用: "Active",
  停用: "Inactive",
  備註: "Notes",
  "單位建立後不可修改，避免改變歷史庫存的意義；不同單位請另建品項。":
    "Units are immutable to preserve historical stock meaning. Create a new item for a different unit.",
  "已儲存。可透過上方搜尋查看資料。":
    "Saved. Use the search above to find the record.",
  儲存變更: "Save changes",
  新增: "Add",
  品項管理: "Manage items",
  櫃位管理: "Manage locations",
  "暫時無法載入主檔，請稍後重新整理或重新登入。":
    "Unable to load master data. Refresh or sign in again.",
  "停用會保留歷史。": "Deactivation retains history. ",
  "品項名稱永久唯一；重複使用請重新啟用原品項。":
    "Item names are permanently unique. Reactivate the original item to reuse it.",
  "同一區域的櫃號不可重複。": "Cabinet names must be unique within an area.",
  顯示狀態: "Status filter",
  全部: "All",
  查詢: "Search",
  "沒有符合條件的資料。": "No matching records.",
  "· 編輯": " · Edit",
  分頁: "Pagination",
  "搜尋品項、位置或單號": "Search item, location or reference",
  異動類型: "Movement type",
  資料狀態: "Record status",
  "開始日期（台北）": "Start date (Taipei)",
  "結束日期（台北）": "End date (Taipei)",
  篩選異動: "Filter movements",
  匯出符合條件的異動: "Export filtered movements",
  "待確認，未計入庫存": "Needs review; excluded from stock",
  "（此請求先前已完成）": " (previously completed request)",
  "連線中斷，請按確認重試；相同請求不會重複寫入。":
    "Connection interrupted. Confirm again to retry; the same request will not be written twice.",
  建立下一筆: "Create another: ",
  查看異動紀錄: "View movement history",
  交易預覽: "Transaction preview",
  確認: "Confirm ",
  目前已確認庫存: "Current confirmed stock",
  本次: "This transaction: ",
  "未知，待確認": "Unknown; needs review",
  預計剩餘庫存: "Expected remaining stock",
  "每容器數量未知：本筆將列為待確認，不計入標準庫存，也不能用於出庫。":
    "Quantity per container is unknown. This record needs review and cannot contribute to available stock or be issued.",
  "確認時會重新檢查最新庫存。原交易會保留，錯誤交易須以沖銷更正。":
    "Stock is checked again on confirmation. Original records are retained; errors require reversal.",
  返回修改: "Back to edit",
  "無法取得預覽，請稍後重試。": "Unable to preview. Please retry later.",
  選擇品項: "Select an item",
  數量輸入方式: "Quantity input method",
  直接輸入標準數量: "Enter standard quantity",
  "容器數 × 每容器數量 ＋ 零散數量":
    "Containers × quantity per container + loose quantity",
  標準數量: "Standard quantity",
  容器種類: "Container type",
  "例如：箱、盒": "e.g. carton, box",
  容器數: "Container count",
  每容器數量: "Quantity per container",
  "未知可留空，將列為待確認": "Leave blank if unknown; review required",
  出庫必填: "Required for stock issues",
  零散數量: "Loose quantity",
  "原始數量文字（選填）": "Original quantity text (optional)",
  "經手人（選填）": "Operator (optional)",
  "單據編號（選填）": "Document reference (optional)",
  "取得預覽…": "Loading preview…",
  預覽: "Preview ",
  "請先在品項管理與櫃位管理建立啟用中的資料。":
    "Create an item and location first using Add item & stock.",
  "沖銷已完成。": "Reversal completed.",
  沖銷此交易: "Reverse transaction",
  "連線中斷，請以相同資料重試。":
    "Connection interrupted. Retry with the same data.",
  將新增數量: "A reversing quantity of ",
  "的反向交易，並保留原紀錄。若造成負庫存，系統將拒絕。":
    " will be added while retaining the original record. Negative stock is rejected.",
  沖銷原因: "Reason for reversal",
  我已核對並確認沖銷: "I have reviewed and confirmed this reversal",
  確認沖銷: "Confirm reversal",
  "處理完成。": "Completed.",
  返回清單: "Back to list",
  待確認預覽: "Review preview",
  "忽略此列，保留歷史且不計庫存":
    "Ignore this row; retain history and exclude from stock",
  已確認庫存: "Confirmed stock",
  "確認時會鎖定後重新檢查；原文與來源保留在紀錄及 audit。":
    "Confirmation locks and rechecks stock; original text and source remain in the record and audit.",
  "連線中斷，可用相同內容重試。":
    "Connection interrupted. Retry with the same content.",
  確認處理: "Confirm review",
  處理方式: "Action",
  補齊資料並確認: "Complete details and confirm",
  "忽略，不計庫存": "Ignore and exclude from stock",
  "標準單位須與品項主檔相同；未確認單位請先到":
    "The standard unit must match the item. For an unknown unit, go to ",
  "補齊。不要把不同單位視為相同數量。":
    " to complete it. Do not treat different units as equivalent.",
  確認標準單位: "Confirm standard unit",
  未註明: "Unspecified",
  數量方式: "Quantity method",
  容器換算: "Container conversion",
  確認數量: "Confirmed quantity",
  容器類型: "Container type",
  "確認／忽略原因": "Reason for confirmation / ignoring",
  預覽處理: "Preview review",
  盤點已完成: "Stocktake completed",
  "（原請求已完成，未重複寫入）":
    " (original request completed; no duplicate write)",
  "：確認時": ": at confirmation ",
  "→ 實際": " → counted ",
  "無差額，不建立交易": "No difference; no movement created",
  "重新載入，建立下一次盤點": "Reload for a new stocktake",
  "目前數量只含已確認庫存。待確認資料不計入，請先核對實物來源，避免重複計數。盤點期間請停止搬動本櫃位物品；確認前若有搬動，請重新清點。每次最多 50 個品項。":
    "Current quantities include confirmed stock only. Check the source of pending records to avoid double counting. Stop moving items during the count; recount if stock moves before confirmation. Maximum 50 items per stocktake.",
  盤點預覽: "Stocktake preview",
  確認盤點差額: "Review count differences",
  "：目前": ": current ",
  無差額: "No difference",
  "確認時會鎖定後重新計算差額，最終結果可能與預覽不同。只更新本次填寫的品項。":
    "Differences are recalculated under a lock on confirmation, so results may differ from the preview. Only entered items are updated.",
  "連線中斷，請以相同內容按確認重試，避免建立重複盤點。":
    "Connection interrupted. Confirm again with the same content to avoid duplicate stocktakes.",
  確認盤點: "Confirm stocktake",
  "留空＝未盤點；輸入 0＝實際為零。":
    "Blank = not counted; 0 = physically empty.",
  實際數量: "Counted quantity",
  "未盤點，留空": "Not counted; leave blank",
  "盤點備註（選填）": "Stocktake notes (optional)",
  預覽盤點: "Preview stocktake",
  掌握庫存與最新異動: "View stock and recent movements",
  "依品項、區域與櫃號搜尋": "Search by item, area or cabinet",
  "手動填入品項、數量、單位與位置": "Enter item, quantity, unit and location",
  記錄新增庫存: "Record incoming stock",
  記錄領用與出庫: "Record outgoing stock",
  核對櫃位的實際數量: "Count physical stock by location",
  維護品項與安全庫存: "Maintain items and safety stock",
  維護區域與櫃號: "Maintain areas and cabinets",
  追溯每一筆庫存異動: "Trace every stock movement",
  確認尚未完成換算的資料: "Review unconfirmed conversions",
  下載庫存與歷史備份: "Download inventory and history",
  系統與帳號設定: "System and account settings",
};
