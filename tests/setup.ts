import { vi } from "vitest";

// Next.js enforces this boundary at build time. Vitest runs server modules in Node.
vi.mock("server-only", () => ({}));

// Isolate existing service tests from the network-backed limiter. Its actual SQL,
// atomicity and failure handling are exercised separately in rate-limit tests.
vi.mock("@/lib/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/security/rate-limit")>();
  return { ...actual, enforceRateLimit: vi.fn() };
});
