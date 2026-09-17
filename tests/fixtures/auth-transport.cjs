// Explicit Node preload for E2E only. Never imported by application code.
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://inventory-test.invalid') throw new Error('Fixture requires the reserved .invalid host');
const original = globalThis.fetch;
const revoked = new Set();
const users = (email) => ({ id: email === 'owner@example.com' ? '00000000-0000-4000-8000-000000000001' : '00000000-0000-4000-8000-000000000002', email, email_confirmed_at: '2026-09-08T00:00:00Z', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-09-08T00:00:00Z', is_anonymous: false });
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (!url.startsWith('https://inventory-test.invalid/auth/v1/')) return original(input, init);
  const fail = () => Response.json({ message: 'Invalid credentials', code: 'invalid_credentials' }, { status: 401 });
  if (url.includes('/token?grant_type=password')) {
    const { email, password } = JSON.parse(init.body);
    if (!['owner@example.com','other@example.com'].includes(email) || password !== 'fixture-password') return fail();
    const now = Math.floor(Date.now()/1000); const user = users(email);
    const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: user.id, email, exp: now+3600, iat: now, nonce: Math.random(), aud: 'authenticated' }].map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.')+'.Zml4dHVyZQ';
    return Response.json({ access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: now+3600, token_type: 'bearer', user });
  }
  const token = new Headers(init.headers).get('authorization')?.replace('Bearer ','');
  if (url.includes('/logout')) { revoked.add(token); return new Response(null, { status: 204 }); }
  if (url.endsWith('/user')) {
    try { if (revoked.has(token)) return fail(); return Response.json(users(JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).email)); } catch { return fail(); }
  }
  return fail();
};
