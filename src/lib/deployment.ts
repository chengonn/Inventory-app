import "server-only";

/** Preview is always read-only, even if it accidentally receives production credentials. */
export function mutationsBlocked() {
  return (
    process.env.VERCEL_ENV === "preview" ||
    process.env.INVENTORY_READ_ONLY === "true"
  );
}
