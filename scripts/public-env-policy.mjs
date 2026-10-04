/** Node/build-time only. Never import this into browser code. */
// Vercel automatically prefixes public deployment metadata. The client
// observability config was also observed in the hosted build environment.
// https://vercel.com/docs/environment-variables/framework-environment-variables
const vercelMetadata = new Set([
  "ENV", "TARGET_ENV", "URL", "BRANCH_URL", "PROJECT_PRODUCTION_URL", "HASH_SALT",
  "GIT_PROVIDER", "GIT_REPO_SLUG", "GIT_REPO_OWNER", "GIT_REPO_ID",
  "GIT_COMMIT_REF", "GIT_COMMIT_SHA", "GIT_COMMIT_MESSAGE",
  "GIT_COMMIT_AUTHOR_LOGIN", "GIT_COMMIT_AUTHOR_NAME", "GIT_PULL_REQUEST_ID",
  "PROJECT_ID", "DEPLOYMENT_ID", "GIT_PREVIOUS_SHA", "OBSERVABILITY_CLIENT_CONFIG",
].map((suffix) => `NEXT_PUBLIC_VERCEL_${suffix}`));

export function validatePublicVariables(environment) {
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith("NEXT_PUBLIC_") || !value) continue;
    if (environment.VERCEL === "1" && vercelMetadata.has(name)) continue;
    // App configuration still has exactly two approved public variables.
    if (!["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"].includes(name)) {
      throw new Error("Unexpected public environment variable");
    }
  }
}
