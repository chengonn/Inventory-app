import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";
import { migrationUrl } from "./config/database";

// Load .env.local just like Next.js; environment variables take precedence.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: migrationUrl(process.env.DIRECT_URL) },
});
