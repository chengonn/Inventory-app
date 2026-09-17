import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function check(values: Record<string, string>) {
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", ...values };
  return spawnSync(process.execPath, ["scripts/check-public-env.mjs"], { env, encoding: "utf8", timeout: 10_000 });
}

describe("real prebuild environment check", () => {
  it("allows compiling the unconfigured setup state", () => {
    const result = check({});
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("503");
  });
  it("rejects an accidentally public secret before Next starts", () => {
    const secret = "sb_secret_fixture_must_not_be_printed";
    const result = check({ NEXT_PUBLIC_SUPABASE_URL: "https://inventory-test.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(secret);
  });
});
