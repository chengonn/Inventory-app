import { test, expect } from "@playwright/test";

test("manual inventory, duplicate protection, zero stock and export-only UI work on this viewport", async ({ page }, info) => {
  test.skip(process.env.E2E_MANUAL_FIXTURE !== "1", "Requires isolated manual runner");
  test.setTimeout(90000);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("密碼", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const name = `Manual-${info.project.name}`;
  const fill = async (item: string, amount: string) => {
    await page.goto("/inventory/new");
    await page.getByLabel("品項名稱", { exact: true }).fill(item);
    await page.getByLabel("初始數量", { exact: true }).fill(amount);
    await page.getByLabel("單位", { exact: true }).fill("包");
    await page.getByLabel("區域", { exact: true }).fill("展示辦公室");
    await page.getByLabel("位置", { exact: true }).fill(info.project.name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (item === name && amount === "2.5") await page.screenshot({ path: `test-results/manual-${info.project.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "建立品項與初始庫存", exact: true }).click();
  };
  await fill(name, "2.5");
  await expect(page.getByRole("status")).toContainText("已建立品項與庫存");
  await fill(name, "99");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("補貨請使用入庫");
  await expect(page.getByLabel("初始數量", { exact: true })).toHaveValue("99");
  await expect(page.getByLabel("品項名稱", { exact: true })).toHaveValue(name);
  await fill(`${name}-zero`, "0");
  await expect(page.getByRole("status")).toContainText("已建立品項與庫存");
  await page.goto(`/inventory?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("main")).toContainText(name);
  await page.goto("/import-export");
  await expect(page.getByRole("heading", { name: "匯出備份", exact: true })).toBeVisible();
  await expect(page.getByLabel("Excel 檔案", { exact: true })).toHaveCount(0);
});
