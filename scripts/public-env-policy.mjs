/** Node/build-time only. Never import this into browser code. */
export function validatePublicVariables(environment) {
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith("NEXT_PUBLIC_") || !value) continue;
    // This project has exactly two approved public configuration variables.
    if (!["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"].includes(name)) {
      throw new Error("Unexpected public environment variable");
    }
  }
}
