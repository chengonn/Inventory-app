import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("initial SQL still matches Prisma's offline schema diff", () => {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], {
    encoding: "utf8", timeout: 20_000, env: { ...process.env, DIRECT_URL: "", DATABASE_URL: "" },
  });
  expect(result.status, result.stderr).toBe(0);
  const initial = readFileSync("prisma/migrations/202609070001_initial_inventory/migration.sql", "utf8");
  const normalize = (sql: string) => sql.replace(/^\uFEFF/, "").replace(/^BEGIN;\s*/, "").replace(/\s*COMMIT;\s*$/, "").replace(/\r\n/g, "\n").trim();
  // The seven original models remain byte-compatible; the additive rate bucket
  // migration and its constraints/privileges are executed in rate-limit.test.ts.
  const rateTable = /-- CreateTable\nCREATE TABLE "inventory"\."RateLimitBucket" \([\s\S]*?\n\);\n\n/;
  expect(result.stdout.replace(/\r\n/g, "\n")).toMatch(rateTable);
  expect(normalize(initial)).toBe(normalize(result.stdout.replace(/\r\n/g, "\n").replace(rateTable, "")));
}, 25_000);

it("release preflight stops before migration when DIRECT_URL is absent", () => {
  const result = spawnSync(process.execPath, ["scripts/require-migration-env.mjs"], {
    encoding: "utf8", timeout: 10_000, env: { ...process.env, DIRECT_URL: "", DATABASE_URL: "runtime-is-not-a-migration-fallback" },
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Migration 尚未執行");
  expect(result.stdout + result.stderr).not.toContain("runtime-is-not-a-migration-fallback");
});
