import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../src/lib/supabase/server", () => ({
  createClient: async () => ({ auth: mocks }), createActionClient: async () => ({ auth: mocks }),
}));
import { allowedEmail, verifyActor } from "../../src/lib/auth/policy";
import { requirePageActor } from "../../src/lib/auth/guard";
import { login, logout } from "../../src/app/login/actions";
const client = { auth: mocks } as unknown as SupabaseClient;
const user = { id: "actor-id", email: "owner@example.com", email_confirmed_at: "2026-09-08", is_anonymous: false };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("ALLOWED_USER_EMAIL", "owner@example.com");
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.redirect.mockImplementation((url) => { throw new Error(`REDIRECT:${url}`); });
});
afterEach(() => vi.unstubAllEnvs());
it("fails closed without valid allowed email", async () => {
  vi.stubEnv("ALLOWED_USER_EMAIL", "");
  expect(allowedEmail()).toBeNull();
  expect(await verifyActor(client)).toEqual({ status: "unavailable" });
  expect(mocks.getUser).not.toHaveBeenCalled();
});
it("uses fresh verified identity and only returns the actor DTO", async () => {
  expect(await verifyActor(client)).toEqual({ status: "allowed", actor: { id: user.id, email: user.email } });
  expect(mocks.getUser).toHaveBeenCalledOnce();
});
it.each([
  { ...user, email: "other@example.com" }, { ...user, email_confirmed_at: null }, { ...user, is_anonymous: true },
])("rejects an unauthorized user", async (candidate) => {
  mocks.getUser.mockResolvedValue({ data: { user: candidate }, error: null });
  expect(await verifyActor(client)).toEqual({ status: "forbidden" });
});
it.each([401, 403, 429, 500])("handles Auth errors without trusting accompanying user (%s)", async (status) => {
  mocks.getUser.mockResolvedValue({ data: { user }, error: { status } });
  expect((await verifyActor(client)).status).toBe(status < 429 ? "anonymous" : "unavailable");
});
it("redirects an anonymous page request to login", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(requirePageActor()).rejects.toThrow("REDIRECT:/login");
});
function form() { const value = new FormData(); value.set("email", user.email); value.set("password", "private-test-password"); value.set("next", "https://evil.invalid"); return value; }
it("logs in and uses a fixed dashboard redirect", async () => {
  await expect(login({ error: "" }, form())).rejects.toThrow("REDIRECT:/dashboard");
  expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: user.email, password: "private-test-password" });
});
it("signs out a successfully authenticated non-allowed identity", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { ...user, email: "other@example.com" } }, error: null });
  expect(await login({ error: "" }, form())).toEqual({ error: "此帳號無權使用本系統。" });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it("does not leak SDK error details or submitted passwords", async () => {
  mocks.signInWithPassword.mockResolvedValue({ error: { status: 400, message: "private-test-password" } });
  expect(JSON.stringify(await login({ error: "" }, form()))).not.toContain("private-test-password");
});
it("rejects malformed form without making an Auth call", async () => {
  await login({ error: "" }, new FormData());
  expect(mocks.signInWithPassword).not.toHaveBeenCalled();
});
it("logout clears the current session only", async () => {
  await expect(logout()).rejects.toThrow("REDIRECT:/login?reason=signed_out");
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("logout failure never reports success", async () => {
  mocks.signOut.mockResolvedValue({ error: { status: 503 } });
  await expect(logout()).rejects.toThrow("REDIRECT:/login?reason=logout_failed");
});
