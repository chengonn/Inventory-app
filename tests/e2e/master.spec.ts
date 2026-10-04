import { test, expect } from "@playwright/test";
test("master pages are usable on mobile and reject invalid quantity without writing data", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_FIXTURE !== "1", "Requires isolated Auth transport");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("密碼", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  for (const [path, title, add] of [["items", "品項管理", "新增品項"], ["locations", "櫃位管理", "新增櫃位"]]) {
    await page.goto(`/${path}?q=step5-browser-no-match-${Date.now()}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText("沒有符合條件的資料。")).toBeVisible();
    await page.getByText(add, { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (path === "items") {
      await page.getByLabel("品項名稱", { exact: true }).fill("驗證用，不應寫入");
      await page.getByLabel("安全庫存", { exact: true }).fill("-1");
      await page.getByRole("button", { name: "新增", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "安全庫存須為非負數" })).toBeVisible();
      await expect(page.getByLabel("品項名稱", { exact: true })).toHaveValue("驗證用，不應寫入");
    } else {
      await expect(page.getByLabel("區域", { exact: true })).toBeVisible();
      await expect(page.getByLabel("櫃號", { exact: true })).toBeVisible();
    }
  }
});
