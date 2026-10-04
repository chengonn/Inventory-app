import { vi } from "vitest";

// Next.js enforces this boundary at build time. Vitest runs server modules in Node.
vi.mock("server-only", () => ({}));
