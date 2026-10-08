import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const baseURL='http://localhost:3000';
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
try {
 const context=await browser.newContext({baseURL,viewport:{width:1100,height:1000}});
 const csrf=await (await context.request.get('/api/auth/csrf')).json();
 await context.request.post('/api/auth/callback/credentials',{form:{csrfToken:csrf.csrfToken,demoRole:'user',json:'true',callbackUrl:baseURL}});
 const page=await context.newPage();
 let checks=0;
 let settled=false;
 const reference='enrivea-'+'1'.repeat(32);
 const purchase={reference,kind:'topup',credits:25,expectedAmount:1500,currency:'USD',status:'pending',mode:'live',provider:'nowpayments',payAddress:'0x1234567890123456789012345678901234567890',payAmount:'15',payCurrency:'usdtbsc',payNetwork:'BNB Smart Chain (BEP20)',payExtraId:'123456',providerStatus:'waiting',providerPaymentId:'fixture-only',authorizationUrl:'',failureCode:''};
 await page.route('**/api/billing/purchases/'+reference,async route=>{
  if(route.request().method()==='POST'){checks++;return route.fulfill({json:{status:settled?'paid':'pending'}});}
  return route.fulfill({json:{purchase:{...purchase,status:settled?'paid':'pending'}}});
 });
 await page.goto('/dashboard/checkout/'+reference);
 await page.locator('svg').filter({has:page.locator('title',{hasText:'Payment address QR code'})}).waitFor();
 assert.ok(checks>0,'Provider verification happens without button click');
 await page.getByText('Required memo / destination tag',{exact:true}).waitFor();
 assert.ok(await page.locator('img[src="https://nowpayments.io/images/coins/usdtbsc.svg"]').count());
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'No mobile overflow');
 settled=true;
 await page.getByRole('heading',{name:'Payment complete',exact:true}).waitFor({timeout:35000});
 assert.equal(await page.locator('svg title').filter({hasText:'Payment address QR code'}).count(),0,'QR removed after settlement');
 console.log('PASS: QR, coin icon, memo, automatic verification and paid transition, mobile width. All payment responses mocked; no money moved.');
} finally {await browser.close();}
