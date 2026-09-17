import nextEnv from '@next/env';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
nextEnv.loadEnvConfig(process.cwd(), true);
const schema = `inventory_test_${crypto.randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.DATABASE_URL);
if (!url.hostname.endsWith('.pooler.supabase.com') || url.port !== '6543') throw new Error('Development transaction pooler required');
url.search = '';
const pool = new Pool({ connectionString: url.toString(), max: 2, ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n') } : {}) } });
const port = 3035;
// Never attach to or stop someone else's server.
await new Promise((resolve, reject) => { const probe = createServer(); probe.once('error', reject); probe.listen(port, '127.0.0.1', () => probe.close(resolve)); });
let server, created = false;
try {
  await pool.query(`CREATE SCHEMA "${schema}"`); created = true;
  for (const name of ['202609070001_initial_inventory', '202609070002_inventory_integrity']) await pool.query((await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8')).replace(/\binventory\b/g, schema));
  for (const viewport of ['desktop', 'mobile', 'android']) {
    const name = `E2E-${viewport}`;
    const item = await pool.query(`INSERT INTO "${schema}"."Item" (name,unit,"updatedAt") VALUES ($1,'個',now()) RETURNING id`, [name]);
    const loc = await pool.query(`INSERT INTO "${schema}"."Location" (area,"cabinetNo","updatedAt") VALUES ($1,'1',now()) RETURNING id`, [name]);
    await pool.query(`INSERT INTO "${schema}"."OpeningInventory" ("itemId","locationId","normalizedQty") VALUES ($1,$2,10)`, [item.rows[0].id, loc.rows[0].id]);
    const countLocation = await pool.query(`INSERT INTO "${schema}"."Location" (area,"cabinetNo","updatedAt") VALUES ($1,'1',now()) RETURNING id`, [`Count-${viewport}`]);
    for (const kind of ['gain', 'loss', 'same']) {
      const countItem = await pool.query(`INSERT INTO "${schema}"."Item" (name,unit,"updatedAt") VALUES ($1,'個',now()) RETURNING id`, [`Count-${viewport}-${kind}`]);
      await pool.query(`INSERT INTO "${schema}"."OpeningInventory" ("itemId","locationId","normalizedQty") VALUES ($1,$2,10)`, [countItem.rows[0].id, countLocation.rows[0].id]);
    }
  }
  const searchLocations = [];
  for (const [area, cabinet] of [['Search-A', 'QA-001'], ['Search-B', 'QB-002']]) searchLocations.push((await pool.query(`INSERT INTO "${schema}"."Location" (area,"cabinetNo","updatedAt") VALUES ($1,$2,now()) RETURNING id`, [area, cabinet])).rows[0].id);
  for (const [name, safety] of [['Q-global', '8'], ['Q-low', '5'], ['Q-review', '1'], ['Q-empty', null]]) {
    const id = (await pool.query(`INSERT INTO "${schema}"."Item" (name,"safetyStock","updatedAt") VALUES ($1,$2,now()) RETURNING id`, [name, safety])).rows[0].id;
    if (name !== 'Q-empty') await pool.query(`INSERT INTO "${schema}"."OpeningInventory" ("itemId","locationId","normalizedQty",status) VALUES ($1,$2,$3,$4)`, [id, searchLocations[0], name === 'Q-review' ? null : name === 'Q-global' ? '1' : '2', name === 'Q-review' ? 'NEEDS_REVIEW' : 'CONFIRMED']);
    if (name === 'Q-global') await pool.query(`INSERT INTO "${schema}"."OpeningInventory" ("itemId","locationId","normalizedQty") VALUES ($1,$2,9)`, [id, searchLocations[1]]);
  }
  for (let i = 1; i <= 21; i++) await pool.query(`INSERT INTO "${schema}"."Item" (name,"updatedAt") VALUES ($1,now())`, [`Page-${String(i).padStart(2, '0')}`]);
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://inventory-test.invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_test_only', ALLOWED_USER_EMAIL: 'owner@example.com', E2E_DB_SCHEMA: schema, E2E_MOVES_FIXTURE: '1', E2E_AUTH_FIXTURE: '1', E2E_BASE_URL: `http://127.0.0.1:${port}`, NODE_OPTIONS: '--use-system-ca' };
  server = spawn(process.execPath, ['--require', './tests/fixtures/moves-transport.cjs', 'node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  // Keep raw server errors (which may contain DB details) out of console output.
  let serverLog = '';
  server.stdout.on('data', (data) => { serverLog += data.toString(); });
  server.stderr.on('data', (data) => { serverLog += data.toString(); });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) {
      const safe = serverLog.replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/g, '[URL]').replaceAll(decodeURIComponent(url.password), '[REDACTED]').replace(/(?:sb_|eyJ)[A-Za-z0-9._-]+/g, '[TOKEN]');
      console.error(safe.slice(-4000));
      throw new Error('Isolated server exited before readiness');
    }
    try { const response = await fetch(`${env.E2E_BASE_URL}/login`, { signal: AbortSignal.timeout(2000) }); if (response.ok) { ready = true; break; } } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error('Isolated server not ready');
  console.log('Isolated browser server ready; testing desktop and two mobile viewports.');
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--workers=1'], { env, windowsHide: true, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  if (code !== 0) process.exitCode = 1;
  const result = await pool.query(`SELECT (SELECT count(*) FROM "${schema}"."StockMove")::int AS moves,(SELECT count(*) FROM "${schema}"."AuditLog" WHERE "entityType"='StockMove')::int AS audits`);
  if (code === 0 && (result.rows[0].moves !== 18 || result.rows[0].audits !== 18)) throw new Error('Browser commit/audit verification failed');
  console.log(`Isolated DB verification: ${result.rows[0].moves} moves, ${result.rows[0].audits} audits.`);
  const counts = await pool.query(`SELECT count(*)::int n FROM "${schema}"."AuditLog" WHERE "entityType"='Stocktake'`);
  if (code === 0 && counts.rows[0].n !== 6) throw new Error('Stocktake receipt audit verification failed');
  console.log(`Stocktake receipt audits: ${counts.rows[0].n}.`);
} finally {
  if (server?.pid && server.exitCode === null) {
    await new Promise((resolve) => {
      const timer = setTimeout(() => server.kill('SIGKILL'), 10000);
      server.once('exit', () => { clearTimeout(timer); resolve(); });
      server.send({ inventoryTestShutdown: true });
    });
    console.log('Isolated server stopped.');
  }
  try {
    if (created && /^inventory_test_[0-9a-f]{32}$/.test(schema)) { await pool.query(`DROP SCHEMA "${schema}" CASCADE`); console.log('Disposable schema removed.'); }
  } finally { await pool.end(); }
}
