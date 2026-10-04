import { test, expect } from "@playwright/test";

test("anonymous pages and API are guarded on desktop and mobile", async ({ page, request }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "登入庫存管理" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const response = await request.get("/api/auth/session");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await page.goto("/inventory");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/stocktake");
  await expect(page).toHaveURL(/\/login$/);
});

test("login errors, allowed login, protected API, login redirect and logout", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_FIXTURE !== "1", "Requires explicitly isolated Auth fixture");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("密碼", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "無法登入" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("密碼", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await page.request.get("/api/auth/session")).status()).toBe(204);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed_out$/);
  expect((await page.request.get("/api/auth/session")).status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("authenticated non-allowed email is signed out and denied", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_FIXTURE !== "1", "Requires explicitly isolated Auth fixture");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("other@example.com");
  await page.getByLabel("密碼", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "此帳號無權使用本系統" })).toBeVisible();
  expect((await page.request.get("/api/auth/session")).status()).toBe(401);
});
