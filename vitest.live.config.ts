import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

// Next intentionally ignores .env.local in test mode. This opt-in live suite
// explicitly loads development credentials, then restores Vitest's mode.
const previousMode = process.env.NODE_ENV;
Object.assign(process.env, { NODE_ENV: "development" });
nextEnv.loadEnvConfig(process.cwd(), true, console, true);
Object.assign(process.env, { NODE_ENV: previousMode ?? "test" });
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    env: Object.fromEntries(["DATABASE_URL", "DB_POOL_MAX", "DATABASE_SSL_CA"].map((key) => [key, process.env[key] ?? ""])),
    include: ["tests/live/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
});
