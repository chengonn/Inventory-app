import { test, expect } from "@playwright/test";
test("IN preview/confirm, review-only IN, OUT and reversal work at this viewport", async ({ page }, info) => {
  test.skip(process.env.E2E_MOVES_FIXTURE !== "1", "Requires disposable schema runner");
  test.setTimeout(90000);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("密碼", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const pick = async (kind: string) => {
    await page.goto(`/moves/${kind}`);
    // Fails before any mutation if the test transport did not isolate the DB.
    await page.getByRole("combobox", { name: "品項", exact: true }).selectOption({ label: `E2E-${info.project.name}（個）` });
    await page.getByRole("combobox", { name: "櫃位", exact: true }).selectOption({ label: `E2E-${info.project.name} / 1` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  await pick("in");
  await page.getByLabel("標準數量", { exact: true }).fill("5");
  await page.getByRole("button", { name: "預覽", exact: true }).click();
  const preview = page.getByRole("region", { name: "交易預覽" });
  await expect(preview).toContainText("15.000");
  await page.getByRole("button", { name: "返回修改", exact: true }).click();
  await expect(page.getByLabel("標準數量", { exact: true })).toHaveValue("5");
  await page.getByRole("button", { name: "預覽", exact: true }).click();
  await expect(preview).toContainText("10.000"); // Preview never wrote the IN.
  await page.getByRole("button", { name: "確認入庫", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已確認");
  await pick("in");
  await page.getByRole("combobox", { name: "數量輸入方式", exact: true }).selectOption("container");
  await page.getByLabel("容器種類", { exact: true }).fill("箱");
  await page.getByLabel("容器數", { exact: true }).fill("8");
  await page.getByRole("button", { name: "預覽", exact: true }).click();
  await expect(preview).toContainText("不計入標準庫存");
  await page.getByRole("button", { name: "確認入庫", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("待確認，未計入庫存");
  await pick("out");
  await page.getByLabel("標準數量", { exact: true }).fill("16");
  await page.getByRole("button", { name: "預覽", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "庫存不足" })).toBeVisible();
  await page.getByLabel("標準數量", { exact: true }).fill("7");
  await page.getByRole("button", { name: "預覽", exact: true }).click();
  await expect(preview).toContainText("15.000"); await expect(preview).toContainText("8.000");
  await page.getByRole("button", { name: "確認出庫", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已確認");
  await page.getByRole("link", { name: "查看異動紀錄" }).click();
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: `出庫 · E2E-${info.project.name}`, exact: true }) });
  await card.getByText("沖銷此交易", { exact: true }).click();
  await card.getByLabel("沖銷原因", { exact: true }).fill("E2E correction");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "確認沖銷", exact: true }).click();
  await expect(page.getByRole("heading", { name: `沖銷 · E2E-${info.project.name}`, exact: true })).toBeVisible();
  await pick("out");
  await page.getByLabel("標準數量", { exact: true }).fill("15");
  await page.getByRole("button", { name: "預覽", exact: true }).click();
  await expect(preview).toContainText("15.000"); await expect(preview).toContainText("0.000");
});

