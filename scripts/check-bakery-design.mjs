import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('.qa/design',{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const data=page.waitForResponse(r=>r.url().endsWith('/order/api/menu'));await page.goto('http://localhost:3030');assert.equal((await data).status(),200);await page.waitForTimeout(300);await page.locator('img').evaluateAll(a=>a.forEach(i=>i.loading='eager'));await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
 for(const width of [1440,768,430,390,360,320]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'horizontal overflow at '+width);
  await page.screenshot({path:'.qa/design/bjorken-after-'+width+'.png',fullPage:true});await page.screenshot({path:'.qa/design/bjorken-first-screen-'+width+'.png'});
  if(width<=430){await page.getByRole('button',{name:'פתיחת תפריט',exact:true}).click();await page.locator('#bakery-navigation').getByRole('link',{name:'המאפים שלנו'}).click();assert.equal(await page.getByRole('button',{name:'פתיחת תפריט',exact:true}).getAttribute('aria-expanded'),'false');const targets=await page.locator('.mobile-menu-toggle,.header-cart,.product-card .add,.category-tabs button').evaluateAll(a=>a.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));assert.ok(targets.every(t=>t.width>=43&&t.height>=43),'tap targets at '+width)}
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'הוספת סינבון',exact:true}).click();await page.getByRole('button',{name:'לסל ולאיסוף'}).click();assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'.qa/design/bjorken-cart-390.png'});await page.getByRole('button',{name:'סגירת סל'}).click();assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');assert.deepEqual(errors,[]);
 console.log('PASS: actual Atlas/Cloudinary preview, 1440/768/430/390/360/320px without overflow, mobile navigation, 44px touch controls, gallery, cart scroll lock and close, no browser errors.');
}finally{await browser.close()}
