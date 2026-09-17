import { describe, expect, it } from "vitest";
import { migrationUrl, runtimePoolConfig } from "../../config/database";

const pooled = "postgresql://postgres.testref:fixture@aws-0-test.pooler.supabase.com:6543/postgres";
const direct = "postgresql://postgres:fixture@db.testref.supabase.co:5432/postgres?sslmode=require&schema=inventory";

describe("separate PostgreSQL connection configuration", () => {
  it("uses a small bounded pg pool with TLS certificate verification", () => {
    const options = runtimePoolConfig(pooled);
    expect(options.connectionString).toBe(pooled);
    expect(options.max).toBe(2);
    expect(options.connectionTimeoutMillis).toBe(5000);
    expect(options.ssl.rejectUnauthorized).toBe(true);
  });
  it("moves SSL configuration to pg options without losing a supplied CA", () => {
    const options = runtimePoolConfig(`${pooled}?pgbouncer=true&schema=inventory&sslmode=require`, "3", "first\\nsecond");
    expect(options.connectionString).toBe(pooled);
    expect(options.ssl).toEqual({ rejectUnauthorized: true, ca: "first\nsecond" });
    expect(options.max).toBe(3);
  });
  it.each([undefined, "file:inventory.db", direct, pooled.replace(":6543", ":5432"), pooled.replace(".pooler.supabase.com", ".example.com"), `${pooled}?sslmode=disable`, `${pooled}?connection_limit=1`])("rejects missing/non-transaction runtime URLs", (value) => {
    expect(() => runtimePoolConfig(value)).toThrow();
  });
  it.each(["0", "11", "2.5", "NaN", ""])("rejects invalid pool size %s", (value) => {
    expect(() => runtimePoolConfig(pooled, value)).toThrow("DB_POOL_MAX");
  });
  it("CLI allows missing DIRECT_URL for offline commands without substituting DATABASE_URL", () => {
    expect(migrationUrl(undefined)).toBeUndefined();
    expect(migrationUrl("")).toBeUndefined();
  });
  it("accepts explicit TLS direct or IPv4 session-pooler migration URLs", () => {
    expect(migrationUrl(direct)).toBe(direct);
    const session = pooled.replace(":6543", ":5432") + "?sslmode=require&schema=inventory";
    expect(migrationUrl(session)).toBe(session);
  });
  it.each([pooled, direct.replace("5432", "6543"), direct.replace("sslmode=require", "sslmode=disable"), direct.replace("schema=inventory", "schema=public"), direct + "&pgbouncer=true"])("rejects inappropriate migration connections", (value) => {
    expect(() => migrationUrl(value)).toThrow();
  });
  it("never echoes credentials in configuration errors", () => {
    try { runtimePoolConfig("postgresql://private:secret-value@wrong.invalid:1234/postgres"); } catch (error) {
      expect(String(error)).not.toMatch(/private:|secret-value/);
    }
  });
});
