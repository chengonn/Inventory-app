// Run only via setup-guest-account.ps1. Admin key arrives through stdin, never argv/logs.
import { randomBytes, scryptSync } from "node:crypto";
import { open, writeFile, readFile } from "node:fs/promises";
const target = new URL("../.env.guest.local", import.meta.url);
const shareFile = new URL("../.env.guest-share.local", import.meta.url);
const email = "visitor@inventory-demo.invalid";
let reserved;
let stage = "read-key";
try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const key = Buffer.concat(chunks).toString().trim();
  // Reject publishable/anon keys locally without sending them or printing them.
  let validAdminKey = /^sb_secret_[A-Za-z0-9_-]+$/.test(key);
  if (!validAdminKey) {
    try {
      const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
      validAdminKey = claims.role === "service_role" && claims.ref === "vsrvjhidcltrbzixdcgb";
    } catch { /* Not a legacy service-role JWT. */ }
  }
  if (!validAdminKey) {
    console.error("Wrong key type/project: use inventory-v2-dev API Keys > Secret key or legacy service_role, NOT publishable/anon/Connect database password.");
    throw new Error();
  }
  stage = "load-private-settings";
  let config;
  try {
    const existing = await readFile(target, "utf8");
    config = Object.fromEntries(existing.split(/\r?\n/).filter(Boolean).map(line => { const i=line.indexOf("="); return [line.slice(0,i),line.slice(i+1)]; }));
    if (config.DEMO_GUEST_EMAIL !== email || !/^[A-Za-z0-9_-]{64}$/.test(config.DEMO_GUEST_AUTH_PASSWORD ?? "") || !/^[0-9a-f]{64}$/.test(config.DEMO_GUEST_COOKIE_KEY ?? "") || !/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(config.DEMO_GUEST_PASSWORD_HASH ?? "")) throw new Error("Invalid recovery settings");
    console.log("Reusing existing private settings. Existing passwords will not be replaced.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!config) {
  reserved = await open(target, "wx", 0o600);
  const password = randomBytes(48).toString("base64url");
  const guestPassword = randomBytes(18).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  // Save recovery configuration BEFORE the external creation request; never print backend secrets.
  config = {
    DEMO_GUEST_ENABLED: "true", DEMO_GUEST_EMAIL: email,
    DEMO_GUEST_AUTH_PASSWORD: password,
    DEMO_GUEST_PASSWORD_HASH: `${salt}:${scryptSync(guestPassword,salt,64).toString("hex")}`,
    DEMO_GUEST_COOKIE_KEY: randomBytes(32).toString("hex"),
  };
  await reserved.writeFile(Object.entries(config).map(([k,v]) => `${k}=${v}`).join("\n")+"\n");
  await writeFile(shareFile, `Demo URL: https://inventory-portfolio-lac.vercel.app\nEmail: ${email}\nApp password: ${guestPassword}\nNot active until deployment and verification. Share only these visitor credentials.\n`, {flag:"wx",mode:0o600});
  await reserved.close(); reserved = undefined;
  }
  if (config.DEMO_GUEST_USER_ID && !/^[0-9a-f-]{36}$/i.test(config.DEMO_GUEST_USER_ID)) throw new Error();
  stage = config.DEMO_GUEST_USER_ID ? "verify-existing-account" : "create-account";
  const response = await fetch(`https://vsrvjhidcltrbzixdcgb.supabase.co/auth/v1/admin/users${config.DEMO_GUEST_USER_ID ? `/${config.DEMO_GUEST_USER_ID}` : ""}`, {
    method:config.DEMO_GUEST_USER_ID ? "GET" : "POST", redirect:"error", signal:AbortSignal.timeout(20000),
    headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
    ...(config.DEMO_GUEST_USER_ID ? {} : {body:JSON.stringify({email,password:config.DEMO_GUEST_AUTH_PASSWORD,email_confirm:true})}),
  });
  if (!response.ok) {
    // Never print response bodies, submitted keys or headers.
    const hints = {400:"Request rejected; account/email may need checking",401:"Key invalid or belongs to another project",403:"Key does not have admin permission",422:"Account already exists or account fields rejected",429:"Rate limited; retry later",500:"Supabase Auth/database error",503:"Supabase temporarily unavailable"};
    console.error(`Supabase HTTP ${response.status}: ${hints[response.status] ?? "Request failed"}`);
    throw new Error();
  }
  const user = await response.json();
  if (user.email !== email || !/^[0-9a-f-]{36}$/i.test(user.id)) throw new Error();
  stage = "save-account-id";
  if (!config.DEMO_GUEST_USER_ID) {
    reserved = await open(target, "a");
    await reserved.writeFile(`DEMO_GUEST_USER_ID=${user.id}\n`);
  }
  console.log("Visitor created in inventory-v2-dev. Private deployment settings saved in .env.guest.local.");
  console.log("Shareable App login is in .env.guest-share.local. Do NOT share .env.guest.local or the admin key.");
  console.log("Reply: guest account created. Deployment and security acceptance are still pending.");
} catch (error) {
  const safeCodes = new Set(["UNABLE_TO_VERIFY_LEAF_SIGNATURE","CERT_HAS_EXPIRED","ENOTFOUND","ECONNREFUSED","ETIMEDOUT"]);
  const networkCode = error.cause?.code ?? error.code;
  console.error(`Setup incomplete at ${stage}${safeCodes.has(networkCode) ? ` (${networkCode})` : ""}. No secrets printed. Keep existing .env.guest.local for recovery; never delete or overwrite an existing user.`);
  process.exitCode=1;
} finally {await reserved?.close();}
