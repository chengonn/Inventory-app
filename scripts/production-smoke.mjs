// Anonymous HTTPS checks only. Never mutates business records or accepts credentials.
import assert from "node:assert/strict";
const base = new URL(process.argv[2] ?? "https://invalid.invalid");
assert(base.protocol === "https:" && !base.username && !base.password && !base.search && !base.hash && base.pathname === "/" && base.hostname !== "invalid.invalid", "Provide the exact production HTTPS origin, without credentials or paths.");
let checks = 0;
async function get(path) {
  return fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(30000), headers: { "Cache-Control": "no-cache" } });
}
const login = await get("/login");
assert.equal(login.status, 200, "Login must be reachable without Vercel platform login");
const html = await login.text();
assert(html.includes("登入") && html.includes("password"), "Expected the application login form");
checks++;
for (const path of ["/dashboard", "/inventory", "/items", "/locations", "/moves", "/moves/in", "/moves/out", "/stocktake", "/review", "/import-export", "/settings"]) {
  const response = await get(path);
  assert([303, 307, 308].includes(response.status), `${path}: expected login redirect`);
  const target = new URL(response.headers.get("location"), base);
  assert(target.origin === base.origin && target.pathname === "/login", `${path}: redirect must remain on application login`);
  assert(response.headers.get("cache-control")?.includes("no-store"), `${path}: must not cache protected response`);
  console.log(`PASS anonymous ${path}`); checks++;
}
for (const path of ["/api/auth/session", "/api/export?kind=backup", "/api/export?kind=inventory", "/api/export?kind=moves"]) {
  const response = await get(path);
  assert.equal(response.status, 401, `${path}: anonymous must be denied`);
  assert(response.headers.get("cache-control")?.includes("no-store"), `${path}: must not cache auth response`);
  console.log(`PASS anonymous ${path}`); checks++;
}
console.log(`${checks} anonymous HTTPS checks passed. Authenticated DB, business workflows and physical-mobile tests remain separate.`);
