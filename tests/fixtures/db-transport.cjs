// Explicit test preload only. Never imported by application code.
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://inventory-test.invalid' || !/^inventory_test_[0-9a-f]{32}$/.test(process.env.E2E_DB_SCHEMA || '')) throw new Error('Isolated DB fixture configuration required');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg');
const originalQuery = Client.prototype.query;
const rewrite = (sql) => sql.replace(/"inventory"\./g, `"${process.env.E2E_DB_SCHEMA}".`).replace(/\binventory\./g, `${process.env.E2E_DB_SCHEMA}.`);
Client.prototype.query = function(first, ...args) {
  const next = typeof first === 'string' ? rewrite(first) : { ...first, text: rewrite(first.text) };
  return originalQuery.call(this, next, ...args);
};
