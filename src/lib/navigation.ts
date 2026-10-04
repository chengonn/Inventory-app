export const navigation = [
  { href: "/dashboard", label: "總覽", mark: "01", description: "掌握庫存與最新異動" },
  { href: "/inventory", label: "庫存查詢", mark: "02", description: "依品項、區域與櫃號搜尋" },
  { href: "/moves/in", label: "入庫", mark: "03", description: "記錄新增庫存" },
  { href: "/moves/out", label: "出庫", mark: "04", description: "記錄領用與出庫" },
  { href: "/stocktake", label: "盤點", mark: "05", description: "核對櫃位的實際數量" },
  { href: "/items", label: "品項管理", mark: "06", description: "維護品項與安全庫存" },
  { href: "/locations", label: "櫃位管理", mark: "07", description: "維護區域與櫃號" },
  { href: "/moves", label: "異動紀錄", mark: "08", description: "追溯每一筆庫存異動" },
  { href: "/review", label: "待確認", mark: "09", description: "確認尚未完成換算的資料" },
  { href: "/import-export", label: "Excel 匯入／匯出", mark: "10", description: "預覽匯入與下載備份" },
  { href: "/settings", label: "設定", mark: "11", description: "系統與帳號設定" },
] as const;

export const quickActions = navigation.filter(({ href }) =>
  ["/inventory", "/moves/in", "/moves/out", "/stocktake"].includes(href),
);
