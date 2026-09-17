import { describe, expect, it } from "vitest";
import { validatePublicVariables } from "../../scripts/public-env-policy.mjs";

describe("pre-build public environment boundary", () => {
  it("allows server secrets to remain server-only", () => {
    expect(() => validatePublicVariables({ DATABASE_URL: "private", DIRECT_URL: "private", SUPABASE_SERVICE_ROLE_KEY: "private", ALLOWED_USER_EMAIL: "private" })).not.toThrow();
  });
  it.each(["NEXT_PUBLIC_DATABASE_URL", "NEXT_PUBLIC_DIRECT_URL", "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_ALLOWED_USER_EMAIL"])("blocks %s before Next can bundle it", (name) => {
    expect(() => validatePublicVariables({ [name]: "private-value" })).toThrow("Unexpected public environment variable");
  });
});
