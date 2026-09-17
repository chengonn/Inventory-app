import { test, expect } from "@playwright/test";

test("unconfigured app returns an explicit non-cacheable 503 without data or secrets", async ({ page, request }) => {
  const response = await page.goto("/dashboard");
  expect(response?.status()).toBe(503);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByText(/Supabase 設定未完成/)).toBeVisible();
  expect(await page.content()).not.toMatch(/sb_secret_|postgresql:\/\/|refresh_token/);
  const api = await request.post("/api/moves", { data: {} });
  expect(api.status()).toBe(503);
  expect(api.headers()["cache-control"]).toContain("no-store");
  const asset = await request.get("/_next/static/nonexistent.js");
  expect(asset.status()).toBe(404);
});
