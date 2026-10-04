import { describe, expect, it } from "vitest";
import { validatePublicVariables } from "../../scripts/public-env-policy.mjs";

describe("pre-build public environment boundary", () => {
  it("accepts documented deployment metadata only on Vercel", () => {
    const metadata = { NEXT_PUBLIC_VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_URL: "example.vercel.app", NEXT_PUBLIC_VERCEL_PROJECT_ID: "prj_example", NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID: "dpl_example", NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA: "abc", NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG: "{}" };
    expect(() => validatePublicVariables({ VERCEL: "1", ...metadata })).not.toThrow();
    expect(() => validatePublicVariables(metadata)).toThrow();
  });
  it("rejects secrets and unknown names even with the Vercel prefix", () => {
    for (const name of ["NEXT_PUBLIC_VERCEL_DATABASE_URL", "NEXT_PUBLIC_VERCEL_OIDC_TOKEN", "NEXT_PUBLIC_DATABASE_URL"]) {
      expect(() => validatePublicVariables({ VERCEL: "1", [name]: "private" })).toThrow();
    }
  });
  it("allows server secrets to remain server-only", () => {
    expect(() => validatePublicVariables({ DATABASE_URL: "private", DIRECT_URL: "private", SUPABASE_SERVICE_ROLE_KEY: "private", ALLOWED_USER_EMAIL: "private" })).not.toThrow();
  });
  it.each(["NEXT_PUBLIC_DATABASE_URL", "NEXT_PUBLIC_DIRECT_URL", "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_ALLOWED_USER_EMAIL"])("blocks %s before Next can bundle it", (name) => {
    expect(() => validatePublicVariables({ [name]: "private-value" })).toThrow("Unexpected public environment variable");
  });
});
