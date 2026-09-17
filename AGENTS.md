# Project instructions

- docs/V2.md is the sole source of truth for this project. Preserve its original text.
- Follow its 13-step implementation sequence; run tests, lint and typecheck before advancing.
- Fixed architecture: Next.js App Router, TypeScript, Tailwind CSS, Vercel, Supabase PostgreSQL, Supabase Auth, Prisma.
- No SQLite, LAN server, public signup, client-side DB credentials or hard-deleted StockMoves.
- Steps 1–3 code and local checks are implemented. A Supabase development project is configured and the real Prisma runtime transaction pooler query passed. Both migrations were applied from the user PowerShell; all 4 live smoke checks passed, including SQL checksums, seven-table RLS and model reads. The agent Windows schema engine encountered TLS P1011; use the user terminal for future CLI migrations if it recurs. Read docs/STEP-03-LIVE.md. Step 4 authorization code and 119 local tests are implemented; isolated Auth browser E2E passed 9/9 and real-config anonymous E2E passed 3/3; real user login, refresh-page session persistence, login-page redirect, logout and post-logout protection are verified. Read docs/STEP-04.md. Steps 4 and 5 are accepted. Step 5 master data CRUD uses deactivation instead of hard delete, validation, optimistic versions and atomic audits. Read docs/STEP-05.md. Step 6 Inventory service is implemented and verified; read docs/STEP-06.md. Step 7 completion and next-step instructions are recorded below. Inventory query helper does not acquire locks or authorize callers; never expose it directly as an endpoint. db:smoke now includes rollback-only master writes; use a development database. Never present placeholder screens as functional inventory workflows.
- Use request-local Supabase server clients and preserve refreshed cookies plus cache headers. Use createActionClient for Server Actions and createRouteClient for Route Handlers; createClient in server.ts is read-only for Server Components.
- Step 7 is now implemented and verified: read docs/STEP-07.md. Final checks: 189 local tests, 14 real DB tests, 15 browser E2E, lint/typecheck/build passed. Step 8 completion and the next step are recorded below; do not implement later steps together. Every future stock mutation (stocktake, import, review) MUST reuse the transaction-level item/location advisory lock protocol in src/lib/moves/transaction.ts, read stock in a separate statement after acquiring locks under ReadCommitted, and write audit atomically. For multiple pairs, acquire locks in itemId/locationId order. The transaction core is internal and requires authenticated, validated callers. db:smoke now also creates disposable inventory_test_<32 hex> schemas for committed concurrency tests and removes only those schemas afterwards. test:e2e:moves uses isolated Auth transport plus a real disposable DB schema; its fixtures must never be imported by application code.
- Do not deploy business data before Step 4 guards are complete. Read docs/SUPABASE-SETUP.md before integrating live Auth.
- Step 8 is implemented and verified; read docs/STEP-08.md. Latest checks: 203 local tests, 22 real DB tests, 18 browser E2E, lint/typecheck/build passed. Step 9 completion and the next step are recorded below. Stocktake reuses ordered pair locks and re-reads stock under ReadCommitted; zero difference creates no StockMove. Its Stocktake AuditLog receipt is the idempotency record, including all-zero counts: never delete these receipts or compare JSONB object key order with JSON.stringify. The development Supabase project was paused on 2026-09-17; it was resumed and all live checks passed without changing credentials or migrations. E2E now validates 18 moves, 18 move audits and 6 count receipt audits in a disposable schema, then stops its own server and cleans the schema.
- Keep actual spreadsheet data and all secrets out of Git and browser bundles.
- Step 9 is implemented and verified; read docs/STEP-09.md. Latest checks: 218 local tests, 24 real DB tests, 21 browser E2E, lint/typecheck/build passed. Next is Step 10 Excel import; do not advance without completing its own checks. Dashboard/query use authorized server-only READ ONLY RepeatableRead snapshots; stock mutations remain ReadCommitted with advisory locks. Low stock is strict all-location confirmed total < configured safetyStock, including inactive history; null safety is not low. Location search must not reduce item totals. No-history rows display confirmed 0 with an explicit unknown-physical-stock label. Today is Taipei UTC+8 and only confirmed IN/OUT are counted. Current filtering/pagination is server-memory over aggregated rows; preserve these semantics if pushing it into SQL for scale.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->




