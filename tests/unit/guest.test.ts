import { afterEach, expect, it, vi } from "vitest";
import { scryptSync } from "node:crypto";
const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => mocks }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: mocks }),
}));
import {
  guestConfig,
  matchesGuestPassword,
  sealGuestToken,
  openGuestToken,
  loginGuest,
  verifyGuest,
  clearGuestSession,
  publicGuestCredentials,
} from "../../src/lib/auth/guest";
import { requireManager } from "../../src/lib/auth/permissions";
import { enforceGuestBudget } from "../../src/lib/security/guest-budget";
import type { Prisma } from "../../src/generated/prisma/client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.resetAllMocks();
});
const key = "ab".repeat(32);
const salt = "cd".repeat(16);
const password = "fixture-guest-password";
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
function configure() {
  vi.stubEnv("INVENTORY_DEMO", "true");
  vi.stubEnv("DEMO_GUEST_ENABLED", "true");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://vsrvjhidcltrbzixdcgb.supabase.co",
  );
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://postgres.vsrvjhidcltrbzixdcgb:fixture@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres",
  );
  vi.stubEnv("ALLOWED_USER_EMAIL", "owner@example.invalid");
  vi.stubEnv("DEMO_GUEST_EMAIL", "demo@example.invalid");
  vi.stubEnv("DEMO_GUEST_USER_ID", "00000000-0000-4000-8000-000000000001");
  vi.stubEnv("DEMO_GUEST_COOKIE_KEY", key);
  vi.stubEnv("DEMO_GUEST_PASSWORD_HASH", hash);
  vi.stubEnv("DEMO_GUEST_AUTH_PASSWORD", "private-backend-password-".repeat(3));
}
it("enables guest only with complete demo-targeted configuration", () => {
  configure();
  expect(guestConfig()).not.toBeNull();
});
it("exposes only the explicit matching public password on the pinned demo", async () => {
  configure();
  expect(await publicGuestCredentials()).toBeNull();
  vi.stubEnv("DEMO_GUEST_PUBLIC_PASSWORD", "incorrect-public-password");
  expect(await publicGuestCredentials()).toBeNull();
  vi.stubEnv("DEMO_GUEST_PUBLIC_PASSWORD", password);
  expect(await publicGuestCredentials()).toEqual({
    email: "demo@example.invalid",
    password,
  });
  vi.stubEnv("INVENTORY_DEMO", "false");
  expect(await publicGuestCredentials()).toBeNull();
});
it("never publishes the backend password even if the hash is misconfigured to match", async () => {
  configure();
  const backend = "private-backend-password-".repeat(3);
  vi.stubEnv("DEMO_GUEST_PUBLIC_PASSWORD", backend);
  vi.stubEnv(
    "DEMO_GUEST_PASSWORD_HASH",
    `${salt}:${scryptSync(backend, salt, 64).toString("hex")}`,
  );
  expect(await publicGuestCredentials()).toBeNull();
});
it.each([
  ["INVENTORY_DEMO", "false"],
  ["DEMO_GUEST_ENABLED", "false"],
  ["NEXT_PUBLIC_SUPABASE_URL", "https://qrfntparukzqokazvvfh.supabase.co"],
  [
    "DATABASE_URL",
    "postgresql://postgres.qrfntparukzqokazvvfh:fixture@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres",
  ],
  ["DEMO_GUEST_EMAIL", "owner@example.invalid"],
  ["DEMO_GUEST_COOKIE_KEY", "short"],
  ["DEMO_GUEST_PASSWORD_HASH", "plain-password"],
  ["DEMO_GUEST_USER_ID", ""],
])("fails closed for %s", (name, value) => {
  configure();
  vi.stubEnv(name, value);
  expect(guestConfig()).toBeNull();
});
it("compares a salted hash without accepting wrong or oversized passwords", async () => {
  expect(await matchesGuestPassword(password, hash)).toBe(true);
  expect(await matchesGuestPassword("wrong-password", hash)).toBe(false);
  expect(await matchesGuestPassword("a".repeat(257), hash)).toBe(false);
});
it("encrypts tokens and rejects tampering or the wrong encryption key", () => {
  const expires = Math.floor(Date.now() / 1000) + 100;
  const value = sealGuestToken("private-access-token", expires, key);
  expect(value).not.toContain("private-access-token");
  expect(Buffer.from(value, "base64url").toString()).not.toContain(
    "private-access-token",
  );
  expect(openGuestToken(value, key)).toBe("private-access-token");
  const bytes = Buffer.from(value, "base64url");
  bytes[30] ^= 1;
  expect(openGuestToken(bytes.toString("base64url"), key)).toBeNull();
  expect(openGuestToken(value, "ef".repeat(32))).toBeNull();
});
it("rejects expired and overlong sessions", () => {
  const now = Math.floor(Date.now() / 1000);
  expect(openGuestToken(sealGuestToken("token", now - 1, key), key)).toBeNull();
  expect(
    openGuestToken(sealGuestToken("token", now + 1201, key), key),
  ).toBeNull();
  expect(openGuestToken("a".repeat(3801), key)).toBeNull();
});
it("blocks guest management while retaining owner behavior", () => {
  expect(() =>
    requireManager({ id: "g", email: "demo@example.invalid", role: "guest" }),
  ).toThrow("訪客");
  expect(() =>
    requireManager({ id: "o", email: "owner@example.invalid" }),
  ).not.toThrow();
});
it("checks guest capacity inside a lock and denies full storage", async () => {
  const tx = {
    $executeRaw: vi.fn(),
    auditLog: { count: vi.fn().mockResolvedValue(2000) },
    item: { count: vi.fn() },
  };
  await expect(
    enforceGuestBudget(tx as unknown as Prisma.TransactionClient, {
      id: "g",
      email: "demo@example.invalid",
      role: "guest",
    }),
  ).rejects.toThrow("容量上限");
  expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
    tx.auditLog.count.mock.invocationCallOrder[0],
  );
});

it("keeps Supabase credentials out of browser cookies and returns guest-only identity", async () => {
  configure();
  vi.stubEnv("NODE_ENV", "production");
  const config = guestConfig()!;
  const user = {
    id: config.id,
    email: config.email,
    email_confirmed_at: "2026-10-19",
    is_anonymous: false,
  };
  mocks.signInWithPassword.mockResolvedValue({
    data: {
      user,
      session: {
        access_token: "private-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    error: null,
  });
  expect(await loginGuest(config.email, password)).toBe(true);
  expect(mocks.signInWithPassword).toHaveBeenCalledWith({
    email: config.email,
    password: config.password,
  });
  const [name, value, options] = mocks.set.mock.calls[0];
  expect(name).toBe("inventory-guest");
  expect(options).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 1200,
  });
  expect(value).not.toContain("private-token");
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  expect(await verifyGuest(value)).toEqual({
    status: "allowed",
    actor: { id: config.id, email: config.email, role: "guest" },
  });
  expect(mocks.getUser).toHaveBeenCalledWith("private-token");
});
it("rejects wrong App password before contacting Supabase", async () => {
  configure();
  expect(await loginGuest(guestConfig()!.email, "incorrect-password")).toBe(
    false,
  );
  expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});
it("rejects a backend user mismatch before setting a session", async () => {
  configure();
  mocks.signInWithPassword.mockResolvedValue({
    data: { user: { id: "owner" }, session: { access_token: "token" } },
    error: null,
  });
  expect(await loginGuest(guestConfig()!.email, password)).toBe(false);
  expect(mocks.set).not.toHaveBeenCalled();
});
it("revalidates identity with Supabase and never accepts mismatched users or Auth outages", async () => {
  configure();
  const cookie = sealGuestToken(
    "token",
    Math.floor(Date.now() / 1000) + 100,
    key,
  );
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "owner" } },
    error: null,
  });
  expect(await verifyGuest(cookie)).toEqual({ status: "forbidden" });
  mocks.getUser.mockResolvedValue({
    data: { user: null },
    error: { status: 503 },
  });
  expect(await verifyGuest(cookie)).toEqual({ status: "unavailable" });
});
it("clears the guest cookie on logout", async () => {
  configure();
  mocks.get.mockReturnValue({ value: "encrypted-session" });
  expect(await clearGuestSession()).toBe(true);
  expect(mocks.delete).toHaveBeenCalledWith("inventory-guest");
});
