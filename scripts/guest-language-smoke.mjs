// Demo only: create fictional stock and retain its audit trail. Never log credentials.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base='https://inventory-portfolio-lac.vercel.app';
const share=await readFile('.env.guest-share.local','utf8');
const email=share.match(/^Email: (.+)$/m)?.[1].trim();
const password=share.match(/^App password: (.+)$/m)?.[1].trim();
assert(email==='visitor@inventory-demo.invalid'&&password);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({baseURL:base,viewport:{width:390,height:844}});
const page=await context.newPage();page.setDefaultTimeout(30000);
const checks=[];let phase='login card';
const mark=value=>{checks.push(value);console.log(`PASS: ${value}`);};
const language=value=>page.getByRole('combobox',{name:'語言 / Language',exact:true}).selectOption(value);
const name=`Language-demo-${Date.now()}`;
try {
 await page.goto('/login');
 await expect(page.getByRole('region',{name:'訪客帳號',exact:true})).toContainText(email);
 await expect(page.getByRole('region',{name:'訪客帳號',exact:true})).toContainText(password);
 await page.getByRole('button',{name:'填入訪客帳密',exact:true}).click();
 await expect(page.getByLabel('Email',{exact:true})).toHaveValue(email);
 await expect(page.getByLabel('密碼',{exact:true})).toHaveValue(password);
 await language('en');
 await expect(page.getByRole('heading',{name:'Sign in to Inventory',exact:true})).toBeVisible();
 await expect(page.getByLabel('Password',{exact:true})).toHaveValue(password);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.getByRole('button',{name:'Fill guest credentials',exact:true}).click();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/guest-login-en.png',fullPage:true});
 mark('Public App credentials, one-click fill, English switch and persisted locale');
 phase='guest sign in';
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/dashboard$/);
 await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
 const cookies=await context.cookies();const guest=cookies.find(c=>c.name==='inventory-guest');
 assert(guest?.httpOnly&&guest.secure&&guest.sameSite==='Strict');
 assert(!cookies.some(c=>c.name.startsWith('sb-')&&c.name.includes('auth-token')&&c.value));
 mark('English guest login and encrypted HttpOnly session');
 phase='manual entry';await page.goto('/inventory/new');
 for(const [label,value] of [['Item name',name],['Initial quantity','3'],['Unit','本'],['Area','Language demo'],['Location',name]]) await page.getByLabel(label,{exact:true}).fill(value);
 await language('zh-Hant');await expect(page.getByLabel('品項名稱',{exact:true})).toHaveValue(name);
 await language('en');await expect(page.getByLabel('Unit',{exact:true})).toHaveValue('本');
 await page.getByRole('button',{name:'Create item & initial stock',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Item and stock created');
 mark('Manual entry survives language changes; original unit retained');
 phase='movements';
 const pick=async kind=>{
   await page.goto(`/moves/${kind}`);
   await page.getByRole('combobox',{name:'Item',exact:true}).selectOption({label:`${name}（本）`});
   await page.getByRole('combobox',{name:'Location',exact:true}).selectOption({label:`Language demo / ${name}`});
 };
 await pick('out');await page.getByLabel('Standard quantity',{exact:true}).fill('4');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Insufficient confirmed stock'})).toBeVisible();
 for(const [kind,quantity,label] of [['in','2','Receive stock'],['out','1','Issue stock']]) {
   await pick(kind);await page.getByLabel('Standard quantity',{exact:true}).fill(quantity);
   await page.getByRole('button',{name:'Preview',exact:true}).click();
   await page.getByRole('button',{name:`Confirm ${label}`,exact:true}).click();
   await expect(page.getByRole('status')).toContainText('Confirmed');
 }
 mark('English IN/OUT previews and confirmations; excessive OUT rejected in English');
 phase='stocktake';await page.goto('/stocktake');
 await page.getByRole('combobox',{name:'Location',exact:true}).selectOption({label:`Language demo / ${name}`});
 await page.getByRole('button',{name:'Load count sheet',exact:true}).click();
 await page.getByLabel(`${name} Counted quantity`,{exact:true}).fill('2');
 await page.getByRole('button',{name:'Preview stocktake',exact:true}).click();
 await expect(page.getByRole('region',{name:'Stocktake preview'})).toContainText('Stock loss -2.000');
 await page.getByRole('button',{name:'Confirm stocktake',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Stocktake completed');
 await page.goto(`/inventory?q=${encodeURIComponent(name)}`);await page.reload();
 await expect(page.getByRole('article').filter({hasText:name})).toContainText('2.000');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'test-results/guest-inventory-en.png',fullPage:true});
 mark('English stocktake, persisted session, final stock 2 and mobile layout');
 phase='authorization';
 for(const kind of ['backup','inventory','moves']) {
   const response=await context.request.get(`/api/export?kind=${kind}`);assert.equal(response.status(),403);
   assert(response.headers()['cache-control'].includes('no-store'));
 }
 for(const route of ['/items','/locations','/import-export']) {await page.goto(route);await expect(page).toHaveURL(/\/inventory$/);}
 await page.goto('/settings');await expect(page.getByRole('heading',{name:'Account & help',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/login/);
 await page.goto('/inventory');await expect(page).toHaveURL(/\/login/);
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 mark('Guest exports/administration denied; English logout and post-logout protection');
 await writeFile('test-results/guest-language-smoke.json',JSON.stringify({base,name,checks,at:new Date().toISOString()},null,2));
}catch{console.error(`FAIL: ${phase}; no credentials or browser diagnostics printed.`);process.exitCode=1;}
finally{await context.close();await browser.close();}
