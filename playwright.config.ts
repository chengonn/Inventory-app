import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: process.env.E2E_UNCONFIGURED === "1" ? "**/setup.spec.ts" : ["**/auth.spec.ts", "**/master.spec.ts", "**/moves.spec.ts", "**/stocktake.spec.ts", "**/query.spec.ts"],
  fullyParallel: true,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "msedge" } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel: "msedge" } },
    { name: "android", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 }, channel: "msedge" } },
  ],
});


