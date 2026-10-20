// Explicit demo-only live acceptance. Creates synthetic inventory and preserves its audit history.
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base = "https://inventory-portfolio-lac.vercel.app";
const share = await readFile(new URL("../.env.guest-share.local", import.meta.url),"utf8");
const email = share.match(/^Email: (.+)$/m)?.[1].trim();
const password = share.match(/^App password: (.+)$/m)?.[1].trim();
assert(email === "visitor@inventory-demo.invalid" && password, "Missing visitor setup");
const name = `訪客驗收-${Date.now()}`;
const checks = [];
let phase = "launch";
const browser = await chromium.launch({headless:true,channel:"msedge"});
const context = await browser.newContext({baseURL:base,viewport:{width:1280,height:900}});
const page = await context.newPage();
page.setDefaultTimeout(25000);
const mark = (check) => {checks.push(check);console.log(`PASS: ${check}`);};
try {
  phase = "guest login";
  await page.goto("/login");
  await page.getByLabel("Email",{exact:true}).fill(email);
  await page.getByLabel("密碼",{exact:true}).fill(password);
  await page.getByRole("button",{name:"登入",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/訪客體驗：共用虛構資料/)).toBeVisible();
  mark("Guest login and restricted-role banner");
  const cookies = await context.cookies();
  const cookie = cookies.find(c=>c.name==="inventory-guest");
  assert(cookie?.httpOnly && cookie.secure && cookie.sameSite==="Strict");
  assert(!cookie.value.startsWith("eyJ") && cookie.value.split(".").length===1);
  assert(!cookies.some(c=>c.name.startsWith("sb-") && c.name.includes("auth-token") && c.value));
  mark("HttpOnly Secure Strict encrypted session; no browser Supabase auth cookie");
  phase = "export rejection";
  for (const kind of ["backup","inventory","moves"]) {
    const r=await context.request.get(`/api/export?kind=${kind}`);
    assert.equal(r.status(),403); assert(r.headers()["cache-control"].includes("no-store"));
  }
  mark("All three direct export requests rejected with 403/no-store");
  phase = "management rejection";
  for (const path of ["/items","/locations","/import-export"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/inventory$/);
  }
  await page.goto("/review");
  await expect(page.getByRole("alert").filter({hasText:"待確認清單暫時無法載入"})).toBeVisible();
  mark("Master/import management redirects and Review data denied");
  phase = "manual create";
  await page.goto("/inventory/new");
  for (const [label,value] of [["品項名稱",name],["初始數量","10"],["單位","本"],["區域","訪客展示驗收"],["位置",name]]) await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByRole("button",{name:"建立品項與初始庫存",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("已建立品項與庫存");
  mark("Manual inventory created with initial 10");
  const pick = async (kind) => {
    await page.goto(`/moves/${kind}`);
    await page.getByRole("combobox",{name:"品項",exact:true}).selectOption({label:`${name}（本）`});
    await page.getByRole("combobox",{name:"櫃位",exact:true}).selectOption({label:`訪客展示驗收 / ${name}`});
  };
  phase = "stock moves";
  await pick("out"); await page.getByLabel("標準數量",{exact:true}).fill("11");
  await page.getByRole("button",{name:"預覽",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"庫存不足"})).toBeVisible();
  mark("Excessive OUT rejected");
  for (const [kind,quantity,label] of [["in","2","入庫"],["out","1","出庫"]]) {
    await pick(kind); await page.getByLabel("標準數量",{exact:true}).fill(quantity);
    await page.getByRole("button",{name:"預覽",exact:true}).click();
    await page.getByRole("button",{name:`確認${label}`,exact:true}).click();
    await expect(page.getByRole("status")).toContainText("已確認");
  }
  mark("IN 2 and OUT 1 confirmed");
  phase = "stocktake";
  await page.goto("/stocktake");
  await page.getByRole("combobox",{name:"櫃位",exact:true}).selectOption({label:`訪客展示驗收 / ${name}`});
  await page.getByRole("button",{name:"載入盤點表",exact:true}).click();
  await page.getByLabel(`${name} 實際數量`,{exact:true}).fill("8");
  await page.getByRole("button",{name:"預覽盤點",exact:true}).click();
  await expect(page.getByRole("region",{name:"盤點預覽"})).toContainText("盤損 -3.000");
  await page.getByRole("button",{name:"確認盤點",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("盤點已完成");
  mark("Stocktake 11 to 8 confirmed");
  await page.goto(`/moves?q=${encodeURIComponent(name)}`);
  await expect(page.getByText("沖銷此交易",{exact:true})).toHaveCount(0);
  mark("Reversal controls unavailable to guest");
  phase = "refresh/mobile";
  await page.goto(`/inventory?q=${encodeURIComponent(name)}`); await page.reload();
  await expect(page.getByRole("article").filter({hasText:name})).toContainText("8.000");
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
  await mkdir("test-results",{recursive:true});
  await page.screenshot({path:"test-results/guest-production-stock.png",fullPage:true});
  mark("Refresh persists session; final 8 and mobile layout verified");
  phase = "tampered session";
  const altered=Buffer.from(cookie.value,"base64url");altered[30]^=1;
  const bad=await browser.newContext({baseURL:base});
  await bad.addCookies([{...cookie,value:altered.toString("base64url")}]);
  const badPage=await bad.newPage();await badPage.goto("/inventory");await expect(badPage).toHaveURL(/\/login/);await bad.close();
  mark("Tampered encrypted cookie denied");
  phase = "logout";
  await page.getByRole("button",{name:"登出",exact:true}).click();await expect(page).toHaveURL(/\/login/);
  assert(!(await context.cookies()).some(c=>c.name==="inventory-guest"));
  await page.goto("/inventory");await expect(page).toHaveURL(/\/login/);
  assert.equal((await context.request.get("/api/export?kind=backup")).status(),401);
  mark("Logout clears session and protected routes reject access");
  await writeFile("test-results/guest-production-smoke.json",JSON.stringify({base,name,checks,passed:true},null,2));
} catch {
  console.error(`Guest smoke failed at ${phase}; credential-bearing error details suppressed.`);
  await writeFile("test-results/guest-production-smoke.json",JSON.stringify({base,name,checks,passed:false,phase},null,2));
  process.exitCode=1;
} finally {await context.close();await browser.close();}
