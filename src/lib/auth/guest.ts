import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const GUEST_COOKIE = "inventory-guest";
const project = "vsrvjhidcltrbzixdcgb";
const ttl = 20 * 60;
const derive = promisify(scrypt);

// 訪客分享的是 App 密碼；Supabase 密碼及原始 access token 永遠不送到瀏覽器。
// 固定展示 project，避免將正式庫設定誤放到 Demo 時開放訪客權限。
export function guestConfig() {
  if (
    process.env.INVENTORY_DEMO !== "true" ||
    process.env.DEMO_GUEST_ENABLED !== "true"
  )
    return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const email = process.env.DEMO_GUEST_EMAIL;
  const id = process.env.DEMO_GUEST_USER_ID;
  const key = process.env.DEMO_GUEST_COOKIE_KEY;
  const hash = process.env.DEMO_GUEST_PASSWORD_HASH;
  const password = process.env.DEMO_GUEST_AUTH_PASSWORD;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    const db = new URL(process.env.DATABASE_URL ?? "");
    if (
      url !== `https://${project}.supabase.co` ||
      !db.hostname.endsWith(".pooler.supabase.com") ||
      db.port !== "6543" ||
      decodeURIComponent(db.username) !== `postgres.${project}`
    )
      return null;
  } catch {
    return null;
  }
  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.toLowerCase() ===
      process.env.ALLOWED_USER_EMAIL?.trim().toLowerCase() ||
    !id ||
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !key ||
    !/^[0-9a-f]{64}$/.test(key) ||
    !hash ||
    !/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(hash) ||
    !password ||
    password.length < 32 ||
    !publishable
  )
    return null;
  return {
    url,
    email: email.toLowerCase(),
    id,
    key,
    hash,
    password,
    publishable,
  };
}

export async function matchesGuestPassword(password: string, stored: string) {
  if (
    password.length < 12 ||
    password.length > 256 ||
    !/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(stored)
  )
    return false;
  const [salt, expected] = stored.split(":");
  const actual = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

let publicPasswordCheck:
  | { password: string; hash: string; valid: Promise<boolean> }
  | undefined;
// Public App password only; never expose the private Supabase password as a fallback.
export async function publicGuestCredentials() {
  const config = guestConfig();
  const password = process.env.DEMO_GUEST_PUBLIC_PASSWORD;
  if (!config || !password || password === config.password) return null;
  // One bounded cache entry avoids running scrypt on every anonymous page request.
  // Configuration changes invalidate the check; deployment/project guards still run each time.
  if (
    publicPasswordCheck?.password !== password ||
    publicPasswordCheck.hash !== config.hash
  )
    publicPasswordCheck = {
      password,
      hash: config.hash,
      valid: matchesGuestPassword(password, config.hash),
    };
  if (!(await publicPasswordCheck.valid)) return null;
  return { email: config.email, password };
}

export function sealGuestToken(token: string, expires: number, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from(`inventory-guest:v1:${project}`));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify({ token, expires })),
    cipher.final(),
  ]);
  const result = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
  if (result.length > 3800) throw new Error("Guest session too large");
  return result;
}

export function openGuestToken(value: string, key: string): string | null {
  try {
    if (value.length > 3800 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      bytes.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(`inventory-guest:v1:${project}`));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
    const now = Math.floor(Date.now() / 1000);
    return typeof data.token === "string" &&
      Number.isInteger(data.expires) &&
      data.expires > now &&
      data.expires <= now + ttl
      ? data.token
      : null;
  } catch {
    return null;
  }
}

function authClient(config: NonNullable<ReturnType<typeof guestConfig>>) {
  return createClient(config.url, config.publishable, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.any([
            AbortSignal.timeout(8000),
            ...(init?.signal ? [init.signal] : []),
          ]),
        }),
    },
  });
}

export async function loginGuest(email: string, password: string) {
  const config = guestConfig();
  if (
    !config ||
    email.trim().toLowerCase() !== config.email ||
    !(await matchesGuestPassword(password, config.hash))
  )
    return false;
  const { data, error } = await authClient(config).auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });
  if (
    error ||
    !data.session ||
    data.user?.id !== config.id ||
    !data.user.email_confirmed_at ||
    data.user.is_anonymous
  )
    return false;
  const expires = Math.min(
    data.session.expires_at ?? 0,
    Math.floor(Date.now() / 1000) + ttl,
  );
  (await cookies()).set(
    GUEST_COOKIE,
    sealGuestToken(data.session.access_token, expires, config.key),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: Math.max(0, expires - Math.floor(Date.now() / 1000)),
    },
  );
  return true;
}

export async function verifyGuest(value?: string) {
  const config = guestConfig();
  if (!config) return null;
  const cookie = value ?? (await cookies()).get(GUEST_COOKIE)?.value;
  if (!cookie) return null;
  const token = openGuestToken(cookie, config.key);
  if (!token) return { status: "anonymous" as const };
  try {
    const { data, error } = await authClient(config).auth.getUser(token);
    if (error)
      return {
        status: (error.status && error.status < 500 && error.status !== 429
          ? "anonymous"
          : "unavailable") as "anonymous" | "unavailable",
      };
    const user = data.user;
    if (
      !user ||
      user.id !== config.id ||
      user.email?.toLowerCase() !== config.email ||
      !user.email_confirmed_at ||
      user.is_anonymous
    )
      return { status: "forbidden" as const };
    return {
      status: "allowed" as const,
      actor: { id: user.id, email: config.email, role: "guest" as const },
    };
  } catch {
    return { status: "unavailable" as const };
  }
}

export async function clearGuestSession() {
  if (process.env.DEMO_GUEST_ENABLED !== "true") return false;
  const store = await cookies();
  const present = Boolean(store.get(GUEST_COOKIE)?.value);
  store.delete(GUEST_COOKIE);
  return present;
}
