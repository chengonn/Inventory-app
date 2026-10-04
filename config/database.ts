/** Shared with Prisma CLI. No environment reads or client instance in this module. */
export const DATABASE_SCHEMA = "inventory";

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

function parseUrl(value: string | undefined, name: string) {
  try {
    if (!value?.trim()) throw new Error();
    const url = new URL(value.trim());
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.username ||
      !url.password || url.pathname !== "/postgres" || url.hash) throw new Error();
    return url;
  } catch {
    throw new DatabaseConfigurationError(`${name} 未設定或格式錯誤；請從 Supabase Connect 複製 PostgreSQL URI。`);
  }
}

function isSupavisor(url: URL) {
  return url.hostname.endsWith(".pooler.supabase.com");
}

/** Supabase shared transaction pooler, confirmed against official docs. */
export function runtimePoolConfig(value: string | undefined, maxValue = "2", ca?: string) {
  const url = parseUrl(value, "DATABASE_URL");
  if (!isSupavisor(url) || url.port !== "6543") {
    throw new DatabaseConfigurationError("DATABASE_URL 必須使用 Supabase Supavisor transaction pooler（6543），不可使用 direct/session connection。");
  }
  // Prisma 7 uses pg Pool options, not the old Rust-engine URL tuning flags.
  for (const [key, val] of url.searchParams) {
    if (key === "schema" && val === DATABASE_SCHEMA) continue;
    if (key === "pgbouncer" && val === "true") continue;
    if (key === "sslmode" && ["require", "verify-full"].includes(val)) continue;
    throw new DatabaseConfigurationError("DATABASE_URL 含不支援的參數；pool 大小請用 DB_POOL_MAX，TLS 憑證請用 DATABASE_SSL_CA。");
  }
  const max = Number(maxValue);
  if (!/^\d+$/.test(maxValue) || !Number.isInteger(max) || max < 1 || max > 10) {
    throw new DatabaseConfigurationError("DB_POOL_MAX 必須是 1–10 的整數。");
  }
  // Explicit pg TLS config avoids URL sslmode overriding ca/rejectUnauthorized.
  url.search = "";
  return {
    connectionString: url.toString(),
    max,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: true, ...(ca?.trim() ? { ca: ca.replace(/\\n/g, "\n") } : {}) },
  };
}

/** Optional ONLY for offline generate/validate/diff; never use a fake fallback. */
export function migrationUrl(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const url = parseUrl(value, "DIRECT_URL");
  const direct = /^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname);
  if (url.port !== "5432" || (!direct && !isSupavisor(url))) {
    throw new DatabaseConfigurationError("DIRECT_URL 必須使用 Supabase direct 或 session pooler（5432），不可使用 transaction pooler。");
  }
  if (url.searchParams.get("pgbouncer") === "true") {
    throw new DatabaseConfigurationError("DIRECT_URL 不可啟用 pgbouncer transaction 模式。");
  }
  if (url.searchParams.get("sslmode") !== "require") {
    throw new DatabaseConfigurationError("DIRECT_URL 必須設定 sslmode=require，以 TLS 執行 migration。");
  }
  const schema = url.searchParams.get("schema");
  if (schema !== DATABASE_SCHEMA) {
    throw new DatabaseConfigurationError("DIRECT_URL 的 schema 必須是 inventory。");
  }
  // No host/user/password/region/port is generated or substituted here.
  return value.trim();
}
