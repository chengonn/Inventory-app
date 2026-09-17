import { test, expect } from "@playwright/test";

test("responsive overview and navigation", async ({ page }, testInfo) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("每一筆庫存，都有跡可循。");
  await expect(page.getByText("等待連接庫存資料")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}.png`, fullPage: true });
  if (testInfo.project.name !== "desktop") {
    await page.getByRole("button", { name: "開啟導覽" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("link", { name: "品項管理" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("品項管理");
    await page.getByRole("button", { name: "開啟導覽" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  } else {
    await page.getByRole("navigation").getByRole("link", { name: "品項管理" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("品項管理");
  }
});

test("mobile-critical actions have usable destinations and touch targets", async ({ page }) => {
  for (const label of ["庫存查詢", "入庫", "出庫", "盤點"]) {
    await page.goto("/dashboard");
    const action = page.getByRole("region", { name: "快速操作" }).getByRole("link").filter({ has: page.getByRole("heading", { name: label, exact: true }) });
    const box = await action.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await action.click();
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
    await expect(page.getByText("功能尚未啟用")).toBeVisible();
  }
  await page.goto("/signup");
  await expect(page.getByText("404")).toBeVisible();
});

