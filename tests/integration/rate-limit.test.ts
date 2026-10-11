import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { bucketQuery } from "../../src/lib/security/rate-limit";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec('CREATE SCHEMA inventory; CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;');
  await db.exec(readFileSync("prisma/migrations/202610080001_rate_limit/migration.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
it("caps attempts persistently, keeps only one bucket row, and resets an expired window", async () => {
  // One explicit transaction gives a stable minute for this deterministic SQL test.
  await db.exec("BEGIN");
  const query = bucketQuery("login");
  // Avoid a wall-clock minute boundary in the test; production uses statement time.
  const sql = query.text.replaceAll("statement_timestamp()", "transaction_timestamp()");
  const results: boolean[] = [];
  for (let i = 0; i < 15; i++) results.push((await db.query<{ allowed: boolean }>(sql, query.values)).rows[0].allowed);
  expect(results).toEqual([...Array(10).fill(true), ...Array(5).fill(false)]);
  expect((await db.query<{ count: number }>('SELECT count FROM inventory."RateLimitBucket"')).rows).toEqual([{ count: 11 }]);
  await db.exec('UPDATE inventory."RateLimitBucket" SET "windowStart" = "windowStart" - interval \'1 minute\'');
  expect((await db.query<{ allowed: boolean }>(sql, query.values)).rows[0].allowed).toBe(true);
  await db.exec("COMMIT");
});
it("rejects arbitrary scopes and removes inherited client privileges", async () => {
  await expect(db.query('INSERT INTO inventory."RateLimitBucket" VALUES ($1, now(), 1)', ["attacker-key"])).rejects.toThrow();
  for (const role of ["anon", "authenticated"]) {
    const result = await db.query<{ allowed: boolean }>("SELECT has_table_privilege($1, 'inventory.\"RateLimitBucket\"', 'SELECT,INSERT,UPDATE,DELETE') AS allowed", [role]);
    expect(result.rows[0].allowed).toBe(false);
  }
  expect((await db.query<{ enabled: boolean }>("SELECT relrowsecurity AS enabled FROM pg_class WHERE oid='inventory.\"RateLimitBucket\"'::regclass")).rows[0].enabled).toBe(true);
});
