import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
async function downloadBook(page: Page, label: string) {
  const waiting = page.waitForEvent("download"); await page.getByRole("button", { name: label, exact: true }).click();
  const download = await waiting; expect(await download.failure()).toBeNull();
  return XLSX.read(await readFile((await download.path())!), { type: "buffer" });
}
test("review confirmation/ignore and all Excel exports work on this viewport", async ({ page }, info) => {
  test.skip(process.env.E2E_MOVES_FIXTURE !== "1", "Requires disposable DB"); test.setTimeout(120000);
  const name = `Review-${info.project.name}`;
  const unauth = await page.request.get("/api/export?kind=backup"); expect([401, 403]).toContain(unauth.status());
  await page.goto("/login"); await page.getByLabel("Email", { exact: true }).fill("owner@example.com"); await page.getByLabel("密碼", { exact: true }).fill("fixture-password"); await page.getByRole("button", { name: "登入", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/review?q=${name}`);
  const card = (type: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name: `${name} · ${type}`, exact: true }) });
  await expect(card("期初")).toContainText("InventoryData / A123");
  await card("期初").getByRole("combobox", { name: "數量方式", exact: true }).selectOption("container");
  await card("期初").getByLabel("容器數", { exact: true }).fill("2"); await card("期初").getByLabel("每容器數量", { exact: true }).fill("3"); await card("期初").getByLabel("零散數量", { exact: true }).fill("1");
  await card("期初").getByLabel("確認／忽略原因", { exact: true }).fill("實際核對 2 盒每盒 3 個加 1 個");
  await card("期初").getByRole("button", { name: "預覽處理", exact: true }).click(); await expect(card("期初")).toContainText("0.000 → 7.000");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/review-${info.project.name}.png`, fullPage: true });
  await card("期初").getByRole("button", { name: "確認處理", exact: true }).click(); await expect(card("期初")).toHaveCount(0);
  await card("出庫").getByLabel("確認數量", { exact: true }).fill("8"); await card("出庫").getByLabel("確認／忽略原因", { exact: true }).fill("核對出庫");
  await card("出庫").getByRole("button", { name: "預覽處理", exact: true }).click(); await expect(card("出庫").getByRole("alert")).toContainText("庫存不足");
  await card("出庫").getByLabel("確認數量", { exact: true }).fill("2"); await card("出庫").getByRole("button", { name: "預覽處理", exact: true }).click(); await card("出庫").getByRole("button", { name: "確認處理", exact: true }).click(); await expect(card("出庫")).toHaveCount(0);
  await card("入庫").getByRole("combobox", { name: "處理方式", exact: true }).selectOption("IGNORE"); await card("入庫").getByLabel("確認／忽略原因", { exact: true }).fill("來源無法核對，忽略並保留歷史");
  await card("入庫").getByRole("button", { name: "預覽處理", exact: true }).click(); await card("入庫").getByRole("button", { name: "確認處理", exact: true }).click(); await expect(page.getByText("沒有待確認資料。", { exact: true })).toBeVisible();
  await page.goto(`/inventory?q=${name}`); await expect(page.getByRole("article")).toContainText("全櫃位總量 5.000");
  const stock = await downloadBook(page, "匯出符合條件的庫存"); const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(stock.Sheets.Inventory); expect(rows).toHaveLength(1); expect(rows[0]["已確認庫存"]).toBe("5.000");
  await page.goto(`/moves?q=${name}&type=OUT&status=CONFIRMED&from=2026-09-24&to=2026-09-24`); await expect(page.getByRole("article")).toHaveCount(1);
  const moves = await downloadBook(page, "匯出符合條件的異動"); const moveRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(moves.Sheets.StockMoves); expect(moveRows).toHaveLength(1); expect(moveRows[0].signedQty).toBe("-2.000");
  await page.goto("/import-export"); const backup = await downloadBook(page, "下載完整 Excel 備份");
  expect(backup.SheetNames).toEqual(expect.arrayContaining(["Items", "Locations", "OpeningInventory", "StockMoves", "NeedsReview", "ArchivedRecords", "AuditLogs", "ImportBatches"]));
  const backupMoves = XLSX.utils.sheet_to_json<Record<string, unknown>>(backup.Sheets.StockMoves); expect(backupMoves.find((r) => r.moveNo === `REVIEW-IN-${info.project.name}`)?.status).toBe("IGNORED");
});
